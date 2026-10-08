import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { pendenciasVarredura, type DadosTemporizador } from '@ramais/db';
import type pg from 'pg';
import type { PgBoss } from 'pg-boss';
import { PUSH } from '../infra/infra.module.js';
import { Nucleo } from '../infra/nucleo.js';
import type { Push } from '../infra/push.js';
import { PushWeb, type InscricaoWeb } from '../infra/push-web.js';
import { BOSS, POOL } from '../infra/tokens.js';
import { DerivarMidia, type DadosDerivarMidia } from '../modules/canais/derivar-midia.js';
import { ProcessarWebhook } from '../modules/canais/processar-webhook.js';
import { Saida } from '../modules/canais/saida.js';
import { Distribuicao } from '../modules/distribuicao/distribuicao.service.js';
import { Escalonamento } from '../modules/distribuicao/escada.service.js';
import { Presencas } from '../modules/equipes/presenca.service.js';
import { Orquestrador, type EntradaMensagem } from '../modules/jornada/orquestrador.js';
import { Acoes } from '../modules/solicitacoes/acoes.js';

interface DadosNotificacao {
  orgId: string;
  /** Uma pessoa da equipe (app e navegador)… */
  pessoaId?: string;
  /** …ou o chat de um quarto (navegador do hóspede, nas sessões ainda válidas). */
  localId?: string;
  titulo: string;
  corpo: string;
  dados: Record<string, string>;
  alta: boolean;
  /** Degrau da escada marcado "fora do turno": vai para o celular em que a pessoa entrou por último. */
  foraDoTurno?: boolean;
  /** Para onde o toque no aviso do navegador leva. Sem isto, sai dos dados (atendimento ou mensagens). */
  url?: string;
}

/** Na web da equipe, o toque abre o atendimento ou as mensagens diretas. */
function urlDaEquipe(dados: Record<string, string>): string {
  if (dados.tipo === 'direta') return '/?tela=diretas';
  if (dados.solicitacaoId) return `/?abrir=${dados.solicitacaoId}`;
  return '/';
}

/** Registra os handlers das filas do pg-boss no processo `worker`. */
@Injectable()
export class Processadores implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('worker');

  constructor(
    @Inject(BOSS) private readonly boss: PgBoss,
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(PUSH) private readonly push: Push,
    private readonly pushWeb: PushWeb,
    private readonly nucleo: Nucleo,
    private readonly webhook: ProcessarWebhook,
    private readonly orquestrador: Orquestrador,
    private readonly saida: Saida,
    private readonly distribuicao: Distribuicao,
    private readonly escalonamento: Escalonamento,
    private readonly acoes: Acoes,
    private readonly presencas: Presencas,
    private readonly derivarMidia: DerivarMidia,
  ) {}

  async onApplicationBootstrap() {
    const b = this.boss;
    // NOTIFY acorda na hora; o polling curto cobre jobs agendados (temporizadores) e quedas do LISTEN.
    const rapido = (n: number) => ({ localConcurrency: n, pollingIntervalSeconds: 1, notifyPollingIntervalSeconds: 2 });
    // Erro num job vira nova tentativa no pg-boss, que não registra nada: o log precisa dizer o quê.
    const comLog =
      <T,>(fila: string, fn: (jobs: { data: T; id: string }[]) => Promise<unknown>) =>
      async (jobs: { data: T; id: string }[]) => {
        try {
          return await fn(jobs);
        } catch (e) {
          this.log.error(`${fila} ${jobs[0]?.id ?? ''}: ${(e as Error).stack ?? (e as Error).message}`);
          throw e;
        }
      };
    await b.work<{ id: number }>('webhook', rapido(2), async ([job]) => this.webhook.processar(job!.data.id));
    await b.work<EntradaMensagem>('mensagem-entrada', rapido(8), comLog('mensagem-entrada', async ([job]) => this.orquestrador.processar(job!.data)));
    await b.work<{ orgId: string; mensagemId: string }>('mensagem-saida', rapido(4), async ([job]) =>
      this.saida.enviar(job!.data.orgId, job!.data.mensagemId),
    );
    await b.work<DadosDerivarMidia>('midia-derivar', rapido(2), comLog('midia-derivar', async ([job]) => this.derivarMidia.processar(job!.data)));
    await b.work<{ orgId: string; setorId: string }>('distribuir', rapido(4), async ([job]) => {
      await this.distribuicao.distribuirSetor(job!.data.orgId, job!.data.setorId);
    });
    await b.work<DadosTemporizador>('temporizador', rapido(4), async ([job]) => this.temporizador(job!.data));
    await b.work<DadosNotificacao>('notificacao', rapido(4), async ([job]) => this.notificar(job!.data));
    await b.work('varredura', async () => this.varrer());
    await b.schedule('varredura', '* * * * *', null, { key: 'principal' });
    this.log.log('filas registradas');
  }

  async onApplicationShutdown() {
    await this.boss.stop({ graceful: true, timeout: 10_000 }).catch(() => undefined);
    await this.pool.end().catch(() => undefined);
  }

  /** Temporizadores não são cancelados, só invalidados: cada um confere se ainda vale. */
  async temporizador(d: DadosTemporizador): Promise<void> {
    if (d.tipo === 'oferta_expira') return this.distribuicao.ofertaExpirou(d.orgId, d.ofertaId);
    if (d.tipo === 'escada') return this.escalonamento.avaliar(d.orgId, d.solicitacaoId);
    await this.nucleo.executar(d.orgId, async (c) => {
      const s = await this.acoes.carregar(c, d.solicitacaoId);
      const cfg = await this.acoes.config(c, s);
      if (d.tipo === 'inatividade_aviso') {
        if (s.versao !== d.versao || s.estado !== 'aguardando_solicitante') return;
        await this.acoes.enviarTextoFixo(c, s, 'aviso_inatividade', {
          minutos: cfg.tempos.inatividadeEncerraMin - cfg.tempos.inatividadeAvisoMin,
        });
      } else if (d.tipo === 'inatividade_encerra') {
        if (s.versao !== d.versao || s.estado !== 'aguardando_solicitante') return;
        const nova = await this.acoes.encerrar(c, s, { tipo: 'sistema' }, 'inatividade');
        if (nova) await this.acoes.enviarTextoFixo(c, nova, 'encerramento');
      } else if (d.tipo === 'espera_longa') {
        // A versão muda a cada oferta; o que importa é ainda estar esperando, uma vez só.
        const ctx = s.contexto as { avisouEspera?: boolean };
        if (!['na_fila', 'oferecida'].includes(s.estado) || ctx.avisouEspera || s.origem !== 'externa') return;
        await this.acoes.atualizar(c, s, { contexto: { ...s.contexto, avisouEspera: true } });
        await this.acoes.enviarTextoFixo(c, s, 'espera_longa');
      }
    });
  }

  /** Push só para quem tem presença ativa (celular de quem saiu não recebe nada), salvo degrau "fora do turno". */
  async notificar(d: DadosNotificacao): Promise<void> {
    if (d.pessoaId) await this.notificarApp(d, d.pessoaId);
    await this.notificarNavegador(d);
  }

  private async notificarApp(d: DadosNotificacao, pessoaId: string): Promise<void> {
    const alvos = await this.nucleo.executar(d.orgId, async (c) => {
      const r = await c.tx.client.query<{ id: string; push_token: string }>(
        `SELECT dp.id, dp.push_token FROM dispositivo dp
          WHERE dp.pessoa_id = $1 AND dp.push_token IS NOT NULL AND dp.ativo
            AND ($2 OR EXISTS (SELECT 1 FROM presenca p WHERE p.pessoa_id = $1 AND p.fim IS NULL AND p.dispositivo_id = dp.id))`,
        [pessoaId, Boolean(d.foraDoTurno)],
      );
      return r.rows;
    });
    for (const a of alvos) {
      const r = await this.push.enviar(a.push_token, { titulo: d.titulo, corpo: d.corpo, dados: d.dados, alta: d.alta });
      if (r === 'token_invalido') {
        await this.nucleo.executar(d.orgId, (c) => c.tx.client.query('UPDATE dispositivo SET push_token = NULL WHERE id = $1', [a.id]));
      }
    }
  }

  /**
   * Navegador: a pessoa recebe em todo navegador em que ativou (é dela, não de um aparelho do setor);
   * o quarto, em toda sessão do chat ainda válida. Falha aqui não refaz o job (o app já foi avisado).
   */
  private async notificarNavegador(d: DadosNotificacao): Promise<void> {
    if (!this.pushWeb.disponivel || (!d.pessoaId && !d.localId)) return;
    const alvos = await this.nucleo.executar(d.orgId, async (c) => {
      const r = d.pessoaId
        ? await c.tx.client.query<InscricaoWeb & { id: string }>('SELECT id, endpoint, p256dh, auth FROM push_web WHERE pessoa_id = $1', [d.pessoaId])
        : await c.tx.client.query<InscricaoWeb & { id: string }>(
            `SELECT DISTINCT ON (pw.endpoint) pw.id, pw.endpoint, pw.p256dh, pw.auth
               FROM push_web pw JOIN chat_sessao cs ON cs.id = pw.chat_sessao_id
              WHERE cs.local_id = $1 AND cs.expira_em > now()
              ORDER BY pw.endpoint, cs.criado_em DESC`,
            [d.localId],
          );
      return r.rows;
    });
    const url = d.url ?? urlDaEquipe(d.dados);
    const etiqueta = d.dados.solicitacaoId ?? d.dados.conversaId ?? d.dados.tipo;
    const expiradas: string[] = [];
    for (const a of alvos) {
      const r = await this.pushWeb.enviar(a, { titulo: d.titulo, corpo: d.corpo, url, etiqueta, insistente: d.alta });
      if (r === 'expirada') expiradas.push(a.id);
    }
    if (expiradas.length) {
      await this.nucleo.executar(d.orgId, (c) => c.tx.client.query('DELETE FROM push_web WHERE id = ANY($1::uuid[])', [expiradas]));
    }
  }

  /** Rede de segurança a cada minuto: o que venceu e nenhum temporizador tratou. */
  async varrer(): Promise<void> {
    const pend = await pendenciasVarredura(this.pool);
    for (const p of pend) {
      try {
        if (p.tipo === 'oferta_vencida') await this.distribuicao.ofertaExpirou(p.orgId, p.refId);
        else if (p.tipo === 'setor_com_fila') await this.distribuicao.distribuirSetor(p.orgId, p.refId);
        else if (p.tipo === 'escada') await this.escalonamento.avaliar(p.orgId, p.refId);
        else if (p.tipo === 'presenca_inativa') {
          await this.nucleo.executar(p.orgId, async (c) => {
            const r = await c.tx.client.query<{ pessoa_id: string }>('SELECT pessoa_id FROM presenca WHERE id = $1 AND fim IS NULL', [p.refId]);
            if (r.rows[0]) await this.presencas.encerrar(c, r.rows[0].pessoa_id, 'devolver_fila', undefined, 'inatividade');
          });
        }
      } catch (e) {
        this.log.error(`varredura ${p.tipo} ${p.refId}: ${(e as Error).message}`);
      }
    }
    // Webhooks que ficaram sem processar (fila fora do ar no momento do recebimento).
    const orfaos = await this.pool.query<{ id: string }>(
      `SELECT id FROM sistema.webhook_bruto WHERE processado_em IS NULL AND recebido_em < now() - interval '2 minutes' LIMIT 100`,
    );
    for (const o of orfaos.rows) await this.boss.send('webhook', { id: Number(o.id) });
  }
}
