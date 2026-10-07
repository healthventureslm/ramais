import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CampoColeta, Gatilho, ResultadoRoteamento } from '@ramais/contracts';
import type { ServicosIA, Traducao } from '@ramais/ai';
import {
  aplicarGate,
  destinoNovaMensagem,
  extrairCodigoLocal,
  lerCampo,
  gatilhoPorPalavra,
  gatilhoVencedor,
  normalizarTelefone,
  removerCodigoLocal,
  trocarIdioma,
} from '@ramais/domain';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { ClienteMeta } from '../../infra/meta.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { CONFIG, IA } from '../../infra/tokens.js';
import type { Config } from '../../config.js';
import { Unidades } from '../../infra/unidades.js';
import { comContextoIA, marcarSolicitacaoIA } from '../../infra/uso-ia.js';
import { Distribuicao } from '../distribuicao/distribuicao.service.js';
import { MotorFluxo, type AnaliseFluxo, type EstadoFluxo } from './motor-fluxo.js';
import { Acoes } from '../solicitacoes/acoes.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';

/** Uma mensagem recebida, já separada do payload do webhook. */
export interface EntradaMensagem {
  orgId: string;
  unidadeId: string;
  canalId: string;
  waMessageId: string;
  de: string;
  nomePerfil: string | null;
  tipo: 'texto' | 'imagem' | 'audio' | 'documento';
  texto: string | null;
  midiaId: string | null;
  midiaMime: string | null;
  recebidaEm: string;
  /** Simulador: a conversa nova usa esta versão (rascunho) e é marcada como teste. */
  versaoForcada?: string | null;
  teste?: boolean;
  /** Chat do quarto: o arquivo já está guardado (não há mídia da Meta para baixar). */
  midiaChave?: string | null;
  /** Chat do quarto: o local vem do QR lido, e a conversa não volta a antes da estadia atual. */
  localId?: string | null;
  naoAntesDe?: string | null;
}

/** Chat do quarto: um solicitante por quarto ("quarto:<id>"), em vez de um telefone. */
export const solicitanteDoQuarto = (localId: string) => `quarto:${localId}`;
const identidade = (de: string) => (de.startsWith('quarto:') ? de : normalizarTelefone(de));

interface Preparo {
  solicitacaoId: string;
  mensagemId: string;
  destino: 'continuar' | 'reabrir' | 'nova';
  setorAtualChave: string | null;
  historico: { autor: 'guest' | 'staff' | 'assistant'; texto: string }[];
}

interface Analise {
  textoBase: string;
  idiomaOrigem: string | null;
  /** 0..1: transcrição e tradutor (LLM) são confiáveis; regras dependem do texto. */
  confIdioma: number;
  traducaoPt: Traducao | null;
  traducaoEn: Traducao | null;
  transcricao: { texto: string; idioma: string; modelo: string } | null;
  descricao: { texto: string; modelo: string } | null;
  midiaChave: string | null;
  roteamento: (ResultadoRoteamento & { perguntas: unknown[] }) | null;
  conhecimento: { responde: boolean; resposta: string | null; confianca: number; fontes: string[]; modelo: string } | null;
  falhas: string[];
}

const MINIMO_RESUMO = 140;

/**
 * O ciclo da jornada é fixo: entrada → identificação → resolução/roteamento → atendimento → encerramento.
 * Cada mensagem é processada em três fases, para não segurar transação durante chamadas de IA:
 *   1. registrar (transação): idempotência, solicitante, solicitação, mensagem original.
 *   2. analisar (sem transação): mídia, tradução, roteamento, base de conhecimento.
 *   3. aplicar (transação): gatilhos, identificação, gate, fila, respostas.
 * A ordem por conversa é garantida pela fila `mensagem-entrada` (key_strict_fifo por canal+telefone).
 */
@Injectable()
export class Orquestrador {
  private readonly log = new Logger('jornada');

  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
    private readonly distribuicao: Distribuicao,
    private readonly motor: MotorFluxo,
    private readonly meta: ClienteMeta,
    @Inject(IA) private readonly ia: ServicosIA,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  async processar(e: EntradaMensagem): Promise<void> {
    // O gasto com IA desta mensagem fica com a unidade e, depois de registrar, com a solicitação.
    return comContextoIA({ orgId: e.orgId, unidadeId: e.unidadeId }, async () => {
      const preparo = await this.registrar(e);
      if (!preparo) return; // duplicada
      marcarSolicitacaoIA(preparo.solicitacaoId);
      const analise = await this.analisar(e, preparo);
      await this.aplicar(e, preparo, analise);
    });
  }

  // ------------------------------------------------------------------
  // Fase 1
  // ------------------------------------------------------------------

  private async registrar(e: EntradaMensagem): Promise<Preparo | null> {
    const telefone = identidade(e.de);
    return this.nucleo.executar(
      e.orgId,
      async (c) => {
        const dup = await c.tx.client.query('SELECT 1 FROM mensagem WHERE wa_message_id = $1', [e.waMessageId]);
        if (dup.rowCount) return null;

        const sol = await c.tx.client.query<{ id: string }>(
          `INSERT INTO solicitante (org_id, telefone, nome) VALUES ($1, $2, $3)
           ON CONFLICT (org_id, telefone) DO UPDATE SET nome = coalesce(solicitante.nome, EXCLUDED.nome)
           RETURNING id`,
          [e.orgId, telefone, e.nomePerfil],
        );
        const solicitanteId = sol.rows[0]!.id;

        const { id: versaoAtual, cfg } = await this.unidades.versaoAtual(c.tx, e.unidadeId);
        const ultima = await c.tx.client.query<SolicitacaoRow>(
          `SELECT * FROM solicitacao WHERE solicitante_id = $1 AND unidade_id = $2 AND origem = 'externa'
            ORDER BY criado_em DESC LIMIT 1 FOR UPDATE`,
          [solicitanteId, e.unidadeId],
        );
        // Chat do quarto: a conversa de um hóspede anterior nunca continua com o atual.
        const deOutraEstadia = Boolean(e.naoAntesDe && ultima.rows[0] && new Date(ultima.rows[0].criado_em) < new Date(e.naoAntesDe));
        const anterior = deOutraEstadia ? null : (ultima.rows[0] ?? null);
        const destino = destinoNovaMensagem(
          anterior ? { estado: anterior.estado, resolvidaEm: anterior.resolvida_em, setorId: anterior.setor_id } : null,
          new Date(),
          cfg.tempos.reaberturaHoras,
          { texto: e.texto, temMidia: e.tipo !== 'texto' },
        );

        let s: SolicitacaoRow;
        if (destino === 'nova' || !anterior) {
          // Vínculo ainda válido (QR ou confirmado) acompanha a nova solicitação.
          const v = await c.tx.client.query<{ local_id: string; confirmado: boolean }>(
            `SELECT local_id, confirmado FROM vinculo
              WHERE solicitante_id = $1 AND unidade_id = $2 AND fim > now()
              ORDER BY confirmado DESC, inicio DESC LIMIT 1`,
            [solicitanteId, e.unidadeId],
          );
          const r = await c.tx.client.query<SolicitacaoRow>(
            `INSERT INTO solicitacao (org_id, unidade_id, solicitante_id, canal_id, origem, estado, etapa, jornada_versao_id,
                                      local_id, identificado, ultima_msg_solicitante_em, teste)
             VALUES ($1, $2, $3, $4, 'externa', 'automacao', 'entrada', $5, $6, $7, now(), $8) RETURNING *`,
            [
              e.orgId,
              e.unidadeId,
              solicitanteId,
              e.canalId,
              e.versaoForcada ?? versaoAtual,
              e.localId ?? v.rows[0]?.local_id ?? null,
              // O QR prova que a pessoa esteve no quarto, não quem ela é: dado sensível ainda confere.
              (!e.localId || v.rows[0]?.local_id === e.localId) && (v.rows[0]?.confirmado ?? false),
              e.teste ?? false,
            ],
          );
          s = r.rows[0]!;
          await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'criada', atorTipo: 'solicitante', atorId: solicitanteId });
        } else {
          // Qualquer mensagem do solicitante invalida temporizadores de inatividade (versao++).
          s = await this.acoes.atualizar(c, anterior, { ultima_msg_solicitante_em: new Date() });
        }

        const m = await c.tx.client.query<{ id: string }>(
          `INSERT INTO mensagem (org_id, solicitacao_id, autor_tipo, visibilidade, tipo, texto, midia_mime, midia_chave, wa_message_id, status_envio, criado_em)
           VALUES ($1, $2, 'solicitante', 'externa', $3, $4, $5, $6, $7, 'recebida', $8) RETURNING id`,
          [e.orgId, s.id, e.tipo, e.texto, e.midiaMime, e.midiaChave ?? null, e.waMessageId, new Date(e.recebidaEm)],
        );
        const mensagemId = m.rows[0]!.id;
        c.ef.depois(() =>
          this.nucleo.tempoReal.emitir(this.acoes.salas(s), 'solicitacao:mensagem', { solicitacaoId: s.id, mensagemId }),
        );

        const setorAtual = s.setor_id ? await this.unidades.setorPorId(c.tx, s.setor_id) : null;
        const hist = await c.tx.client.query<{ autor_tipo: string; texto: string | null; traducao: string | null }>(
          `SELECT m.autor_tipo, m.texto,
                  (SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma = 'en'
                    ORDER BY d.criado_em DESC LIMIT 1) AS traducao
             FROM mensagem m
            WHERE m.solicitacao_id = $1 AND m.visibilidade = 'externa' AND m.id <> $2 AND m.texto IS NOT NULL
            ORDER BY m.criado_em DESC LIMIT 2`,
          [s.id, mensagemId],
        );
        return {
          solicitacaoId: s.id,
          mensagemId,
          destino,
          setorAtualChave: setorAtual?.chave ?? null,
          historico: hist.rows.reverse().map((h) => ({
            autor: h.autor_tipo === 'solicitante' ? 'guest' : h.autor_tipo === 'ia' ? 'assistant' : 'staff',
            texto: (h.traducao ?? h.texto ?? '').slice(0, 400),
          })),
        };
      },
      { trava: `conversa:${e.canalId}:${telefone}` },
    );
  }

  // ------------------------------------------------------------------
  // Fase 2 — nada aqui pode derrubar a mensagem: cada falha degrada.
  // ------------------------------------------------------------------

  private async analisar(e: EntradaMensagem, p: Preparo): Promise<Analise> {
    const a: Analise = {
      textoBase: removerCodigoLocal(e.texto ?? ''),
      idiomaOrigem: null,
      confIdioma: 0,
      traducaoPt: null,
      traducaoEn: null,
      transcricao: null,
      descricao: null,
      midiaChave: null,
      roteamento: null,
      conhecimento: null,
      falhas: [],
    };
    const tentar = async <T>(nome: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (erro) {
        a.falhas.push(nome);
        this.log.warn(`${nome} falhou (${p.solicitacaoId}): ${(erro as Error).message}`);
        return null;
      }
    };

    // Mídia: o original fica guardado e ganha uma versão em texto.
    if (e.midiaId || e.midiaChave) {
      const midia = e.midiaChave
        ? await tentar('ler_midia', async () => ({ dados: await this.armazenamento.ler(e.midiaChave!), mime: e.midiaMime ?? 'application/octet-stream' }))
        : await tentar('download_midia', async () => this.meta.baixarMidia(await this.canal(e.orgId, e.canalId), e.midiaId!));
      if (midia && !e.midiaChave) {
        const ext = (midia.mime.split('/')[1] ?? 'bin').split(';')[0];
        const chave = `org/${e.orgId}/mensagem/${p.mensagemId}.${ext}`;
        const salvo = await tentar('salvar_midia', async () => {
          await this.armazenamento.salvar(chave, midia.dados, midia.mime);
          return true;
        });
        if (salvo) a.midiaChave = chave;
      }
      if (midia) {
        if (e.tipo === 'audio') {
          a.transcricao = await tentar('transcricao', () => this.ia.multimodal.transcrever(midia.dados, midia.mime));
          if (a.transcricao) {
            a.textoBase = a.transcricao.texto;
            a.idiomaOrigem = a.transcricao.idioma;
            a.confIdioma = 0.9;
          }
        } else if (e.tipo === 'imagem') {
          a.descricao = await tentar('descricao', () => this.ia.multimodal.descrever(midia.dados, midia.mime, a.textoBase || null));
        }
      }
    }

    const textoParaRotear = [a.textoBase, a.descricao ? `[photo: ${a.descricao.texto}]` : ''].filter(Boolean).join(' ');
    if (!textoParaRotear) return a;

    // Tradução para a equipe (pt) e pivot para o roteador (en), em paralelo.
    if (this.ia.tradutor.disponivel && a.textoBase) {
      const [pt, en] = await Promise.all([
        tentar('traducao_pt', () => this.ia.tradutor.traduzir(a.textoBase, 'pt', { de: a.idiomaOrigem })),
        this.cfg.IA_PIVOT_INGLES
          ? tentar('traducao_en', () => this.ia.tradutor.traduzir(a.textoBase, 'en', { de: a.idiomaOrigem }))
          : Promise.resolve(null),
      ]);
      a.traducaoPt = pt;
      a.traducaoEn = en;
      if (!a.idiomaOrigem && (pt || en)) {
        a.idiomaOrigem = pt?.idiomaOrigem ?? en?.idiomaOrigem ?? null;
        a.confIdioma = 0.9;
      }
    }

    const contexto = await this.nucleo.executar(e.orgId, async (c) => {
      const s = await this.acoes.carregar(c, p.solicitacaoId, false);
      const cfg = await this.acoes.config(c, s);
      const conhecimento = await c.tx.client.query(
        'SELECT chave AS id, pergunta, resposta, tags FROM base_conhecimento WHERE unidade_id = $1 AND ativo',
        [s.unidade_id],
      );
      const local = s.local_id
        ? (await c.tx.client.query('SELECT identificador FROM local WHERE id = $1', [s.local_id])).rows[0]?.identificador
        : null;
      return { cfg, estado: s.estado, local, conhecimento: conhecimento.rows };
    });

    const roteador = this.ia.roteador(contexto.cfg.setores);
    const textoEn = a.traducaoEn?.texto
      ? [a.traducaoEn.texto, a.descricao ? `[photo: ${a.descricao.texto}]` : ''].filter(Boolean).join(' ')
      : null;
    const [rot, kb] = await Promise.all([
      tentar('roteamento', () =>
        roteador.rotear({
          texto: textoParaRotear,
          textoIngles: textoEn,
          historico: p.historico,
          fatos: {
            ...(contexto.local ? { room: String(contexto.local) } : {}),
            local_time: new Date().toLocaleString('en-GB', { timeZone: contexto.cfg.fuso }),
          },
          setores: contexto.cfg.setores.map((s) => ({ chave: s.chave, descricao: s.descricao, casosDeBorda: s.casosDeBorda })),
          setorAtual: p.setorAtualChave,
        }),
      ),
      // A base de conhecimento só responde quem ainda está na automação.
      contexto.estado === 'automacao' || contexto.estado === 'resolvida'
        ? tentar('conhecimento', () => this.ia.respondedor.responder(a.textoBase || textoParaRotear, contexto.conhecimento))
        : Promise.resolve(null),
    ]);
    a.roteamento = rot;
    a.conhecimento = kb;
    if (rot && rot.saida.idioma !== 'outro' && !a.idiomaOrigem) {
      a.idiomaOrigem = rot.saida.idioma;
      a.confIdioma = rot.confianca.idioma;
    }
    return a;
  }

  private async canal(orgId: string, canalId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query('SELECT phone_number_id, credencial_ref FROM canal_whatsapp WHERE id = $1', [canalId]);
      return { phoneNumberId: r.rows[0].phone_number_id as string, credencialRef: r.rows[0].credencial_ref as string };
    });
  }

  // ------------------------------------------------------------------
  // Fase 3
  // ------------------------------------------------------------------

  private async aplicar(e: EntradaMensagem, p: Preparo, a: Analise): Promise<void> {
    const telefone = identidade(e.de);
    await this.nucleo.executar(
      e.orgId,
      async (c) => {
        let s = await this.acoes.carregar(c, p.solicitacaoId);
        const cfg = await this.acoes.config(c, s);
        await this.gravarDerivados(c, p.mensagemId, a);

        // Idioma: o primeiro que dá para saber vale para a conversa. Só troca com detecção
        // confiável, para uma frase curta e ambígua não mudar o idioma de quem já escreveu antes.
        // Pouco texto ("5", "302 Silva", "ok") não troca o idioma de uma conversa já definida;
        // senão um hóspede japonês passaria a receber em inglês (regra em `trocarIdioma`).
        const idioma = a.idiomaOrigem && a.idiomaOrigem !== 'outro' ? a.idiomaOrigem : null;
        const troca = trocarIdioma({
          atual: s.idioma,
          definido: (s.contexto as { idiomaDefinido?: boolean }).idiomaDefinido === true,
          detectado: idioma,
          confianca: a.confIdioma,
          texto: a.textoBase,
          transcrito: Boolean(a.transcricao),
        });
        if (troca && idioma) {
          s = await this.acoes.atualizar(c, s, { idioma, contexto: { ...s.contexto, idiomaDefinido: true } });
          await c.tx.client.query('UPDATE solicitante SET idioma = $2 WHERE id = $1', [s.solicitante_id, idioma]);
        }
        await c.tx.client.query('UPDATE mensagem SET idioma = $2 WHERE id = $1', [p.mensagemId, troca && idioma ? idioma : s.idioma]);

        // Código do QR: liga o telefone ao local pela estadia (só vale para pedido de baixo risco).
        const codigo = extrairCodigoLocal(e.texto ?? '');
        if (codigo) s = await this.vincularPorQr(c, s, codigo);

        // Resposta a uma pergunta que não bloqueou o fluxo (ex.: quarto e sobrenome depois de encaminhar).
        const ctx = s.contexto as {
          coletaPendente?: { campo: CampoColeta; conferir: boolean } | null;
          aguardandoIdentificacao?: boolean;
          pesquisa?: { blocoId: string } | null;
          fluxo?: EstadoFluxo;
        };
        const pendente = ctx.coletaPendente ?? (ctx.aguardandoIdentificacao ? { campo: 'quarto_sobrenome' as const, conferir: true } : null);
        if (pendente && a.textoBase) {
          const v = lerCampo(pendente.campo, a.textoBase);
          if (v) {
            const fluxo = ctx.fluxo ?? null;
            s = await this.acoes.atualizar(c, s, { contexto: { ...s.contexto, coletaPendente: null, aguardandoIdentificacao: false } });
            s = await this.motor.registrarDado(c, s, fluxo, pendente.campo, v, pendente.conferir);
            if (fluxo) s = await this.acoes.atualizar(c, s, { contexto: { ...s.contexto, fluxo } });
            // Se a mensagem era só o dado e já há atendimento, não reroteia.
            if (s.estado !== 'automacao' && s.estado !== 'resolvida' && a.textoBase.split(/\s+/).length <= 6) return;
          }
        }

        // Pesquisa de satisfação: uma nota de 1 a 5 depois de resolvido não reabre o pedido.
        if (ctx.pesquisa && s.estado === 'resolvida') {
          const nota = /^\s*([1-5])\s*[.!]?\s*$/.exec(a.textoBase)?.[1];
          if (nota) {
            const bloco = cfg.fluxo.encerramento.find((b) => b.id === ctx.pesquisa!.blocoId);
            await this.nucleo.evento(c, {
              solicitacaoId: s.id,
              tipo: 'pesquisa_respondida',
              atorTipo: 'solicitante',
              atorId: s.solicitante_id,
              dados: { nota: Number(nota), bloco: ctx.pesquisa.blocoId },
            });
            s = await this.acoes.atualizar(c, s, { contexto: { ...s.contexto, pesquisa: null } });
            if (bloco?.tipo === 'pesquisa') await this.acoes.enviarConteudo(c, s, { tipo: 'livre', texto: bloco.agradecimento });
            return;
          }
        }

        const rot = a.roteamento;
        const porPalavra = gatilhoPorPalavra(a.textoBase, cfg.palavrasChave);
        const gatilho = gatilhoVencedor(porPalavra, rot, cfg.limites);
        const decisaoId = rot ? await this.gravarDecisao(c, s, p.mensagemId, rot, gatilho) : null;

        if (gatilho) {
          await this.tratarGatilho(c, s, gatilho, rot, cfg.setorFallback, a);
          return;
        }

        switch (s.estado) {
          case 'automacao':
          case 'resolvida':
            await this.seguir(c, s, a, decisaoId);
            return;
          case 'aguardando_solicitante':
            s = await this.acoes.transicionar(c, s, 'solicitante_respondeu');
            await this.avisarResponsavel(c, s, a);
            return;
          default:
            await this.avisarResponsavel(c, s, a);
        }
      },
      { trava: `conversa:${e.canalId}:${telefone}` },
    );
  }

  private async gravarDerivados(c: Ctx, mensagemId: string, a: Analise) {
    const ins = async (tipo: string, idioma: string, texto: string, modelo: string, origemId: string | null, alerta: string | null) => {
      const r = await c.tx.client.query<{ id: string }>(
        `INSERT INTO mensagem_derivado (org_id, mensagem_id, tipo, idioma, texto, modelo, origem_id, alerta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [c.tx.orgId, mensagemId, tipo, idioma, texto, modelo, origemId, alerta],
      );
      return r.rows[0]!.id;
    };
    if (a.midiaChave) await c.tx.client.query('UPDATE mensagem SET midia_chave = $2 WHERE id = $1 AND midia_chave IS NULL', [mensagemId, a.midiaChave]);
    // Cadeia explícita: áudio → transcrição → tradução.
    const origem = a.transcricao
      ? await ins('transcricao', a.transcricao.idioma, a.transcricao.texto, a.transcricao.modelo, null, null)
      : null;
    if (a.descricao) await ins('descricao', 'en', a.descricao.texto, a.descricao.modelo, null, null);
    if (a.traducaoPt && a.traducaoPt.idiomaOrigem !== 'pt') {
      await ins('traducao', 'pt', a.traducaoPt.texto, a.traducaoPt.modelo, origem, a.traducaoPt.alerta);
    }
    if (a.traducaoEn && a.traducaoEn.idiomaOrigem !== 'en') {
      await ins('traducao', 'en', a.traducaoEn.texto, a.traducaoEn.modelo, origem, a.traducaoEn.alerta);
    }
  }

  private async gravarDecisao(
    c: Ctx,
    s: SolicitacaoRow,
    mensagemId: string,
    rot: ResultadoRoteamento & { perguntas: unknown[] },
    gatilho: Gatilho | null,
  ): Promise<string> {
    const cfg = await this.acoes.config(c, s);
    const gate = aplicarGate(rot, cfg.limites);
    const r = await c.tx.client.query<{ id: string }>(
      `INSERT INTO decisao_ia (org_id, solicitacao_id, mensagem_id, motor, metodo_confianca, entrada, opcoes, saida,
                               setor_escolhido, confianca, latencia_ms, acao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        c.tx.orgId,
        s.id,
        mensagemId,
        rot.motor,
        rot.metodoConfianca,
        JSON.stringify({ estado: s.estado }),
        JSON.stringify(rot.perguntas),
        JSON.stringify({ saida: rot.saida, confianca: rot.confianca, probsSetor: rot.probsSetor ?? null }),
        rot.saida.setor,
        rot.confianca.setor,
        rot.latenciaMs,
        gatilho ? `gatilho:${gatilho}` : gate.acao,
      ],
    );
    await this.nucleo.evento(c, {
      solicitacaoId: s.id,
      tipo: 'decisao_ia',
      atorTipo: 'ia',
      dados: { motor: rot.motor, setor: rot.saida.setor, confianca: rot.confianca.setor, gatilho },
    });
    return r.rows[0]!.id;
  }

  private textoPt(a: Analise): string {
    const base = a.traducaoPt?.texto ?? a.textoBase;
    const foto = a.descricao ? `[foto] ` : a.transcricao ? '[áudio] ' : '';
    return `${foto}${base}`.slice(0, MINIMO_RESUMO) || (a.descricao ? '[foto]' : '[mensagem]');
  }

  // ---------- Gatilhos globais ----------

  private async tratarGatilho(
    c: Ctx,
    s: SolicitacaoRow,
    g: Gatilho,
    rot: ResultadoRoteamento | null,
    fallback: string,
    a: Analise,
  ): Promise<void> {
    const setorFallback = await this.unidades.setorPorChave(c.tx, s.unidade_id, fallback);
    switch (g) {
      case 'emergencia': {
        // Interrompe tudo, inclusive a identificação.
        await this.acoes.enviarTextoFixo(c, s, 'emergencia');
        const resumo = `EMERGÊNCIA: ${this.textoPt(a)}`;
        if (['automacao', 'resolvida', 'na_fila', 'oferecida'].includes(s.estado) || !s.setor_id) {
          const setorId = s.setor_id ?? setorFallback?.id;
          if (setorId) {
            s = await this.acoes.colocarNaFila(c, s, setorId, {
              urgencia: 'agora',
              ator: { tipo: 'ia' },
              motivo: 'emergencia',
              resumo: s.resumo ?? resumo,
            });
          }
        } else {
          s = await this.acoes.atualizar(c, s, { urgencia: 'agora' });
          await this.avisarResponsavel(c, s, a, 'EMERGÊNCIA');
        }
        await this.acoes.notaInterna(c, s.id, '⚠ O solicitante relatou uma emergência.', { tipo: 'sistema' });
        // No simulador, a emergência segue o fluxo mas não acorda os supervisores.
        if (!s.teste) await this.distribuicao.alertarEmergencia(c, s.unidade_id, s.id, resumo);
        return;
      }
      case 'quer_encerrar': {
        const nova = await this.acoes.encerrar(c, s, { tipo: 'solicitante', id: s.solicitante_id }, 'pedido do solicitante');
        if (nova) await this.acoes.enviarTextoFixo(c, nova, 'encerrado_pelo_solicitante');
        return;
      }
      case 'pede_humano': {
        if (s.estado === 'automacao' || s.estado === 'resolvida') {
          const chave = rot && rot.saida.setor !== 'vago' && rot.saida.setor !== 'nenhum' ? rot.saida.setor : fallback;
          const setor = (await this.unidades.setorPorChave(c.tx, s.unidade_id, chave)) ?? setorFallback;
          await this.acoes.enviarTextoFixo(c, s, 'humano');
          if (setor) {
            await this.acoes.colocarNaFila(c, s, setor.id, {
              ator: { tipo: 'solicitante', id: s.solicitante_id },
              motivo: 'pede_humano',
              resumo: s.resumo ?? this.textoPt(a),
              baixaCerteza: chave === fallback,
            });
          }
        } else {
          await this.avisarResponsavel(c, s, a);
        }
        return;
      }
      case 'setor_errado': {
        // Re-roteia excluindo o setor atual (o roteador já recebeu as opções sem ele).
        const chave = rot && !['vago', 'nenhum'].includes(rot.saida.setor) ? rot.saida.setor : fallback;
        const setor = (await this.unidades.setorPorChave(c.tx, s.unidade_id, chave)) ?? setorFallback;
        if (setor && setor.id !== s.setor_id && s.estado !== 'automacao') {
          await this.acoes.notaInterna(c, s.id, `O solicitante disse que o setor está errado. Transferido para ${setor.nome}.`, {
            tipo: 'sistema',
          });
          await this.acoes.colocarNaFila(c, s, setor.id, { ator: { tipo: 'ia' }, motivo: 'setor_errado', baixaCerteza: true });
          await this.acoes.enviarEncaminhado(c, s, setor);
        } else {
          await this.seguir(c, s, a, null);
        }
        return;
      }
      case 'reclama_demora': {
        // Mostra a posição na fila e sobe a prioridade, não só pede desculpas.
        if ((s.estado === 'na_fila' || s.estado === 'oferecida') && s.setor_id) {
          const setorId = s.setor_id;
          const nova = s.urgencia === 'rotina' ? 'hoje' : 'agora';
          s = await this.acoes.atualizar(c, s, { urgencia: nova });
          const pos = await c.tx.client.query<{ n: number }>(
            `SELECT count(*)::int + 1 AS n FROM solicitacao
              WHERE setor_id = $1 AND estado IN ('na_fila', 'oferecida') AND id <> $2
                AND (CASE urgencia WHEN 'agora' THEN 3 WHEN 'hoje' THEN 2 ELSE 1 END) >= $3
                AND entrou_fila_em < $4`,
            [setorId, s.id, nova === 'agora' ? 3 : 2, s.entrou_fila_em],
          );
          await this.acoes.enviarTextoFixo(c, s, 'posicao_fila', { posicao: pos.rows[0]!.n });
          await this.nucleo.distribuir(c, setorId);
        } else if (s.estado === 'automacao' || s.estado === 'resolvida') {
          await this.seguir(c, s, a, null);
        } else {
          await this.avisarResponsavel(c, s, a, 'reclama da demora');
        }
        return;
      }
    }
  }

  // ---------- Automação (fluxo do construtor) e reabertura ----------

  /** Na automação, o fluxo configurado decide; uma resolvida dentro da janela reabre. */
  private async seguir(c: Ctx, s: SolicitacaoRow, a: Analise, decisaoId: string | null): Promise<void> {
    if (s.estado === 'resolvida') return this.reabrir(c, s, a);
    if (!a.textoBase && !a.descricao && !a.transcricao) {
      await this.acoes.enviarTextoFixo(c, s, 'nao_entendi_midia');
      return;
    }
    await this.motor.executar(c, s, this.paraFluxo(a), decisaoId);
  }

  /** Reaberta dentro da janela: a base responde, ou volta para o mesmo setor (de preferência a mesma pessoa). */
  private async reabrir(c: Ctx, s: SolicitacaoRow, a: Analise): Promise<void> {
    const cfg = await this.acoes.config(c, s);
    const kb = a.conhecimento;
    if (kb?.responde && kb.resposta && kb.confianca >= cfg.limites.respostaAutomatica) {
      await this.acoes.enviarAoSolicitante(c, s, { texto: kb.resposta, idioma: 'pt', autor: { tipo: 'ia' } });
      await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'resposta_automatica', atorTipo: 'ia', dados: { fontes: kb.fontes, confianca: kb.confianca } });
      return;
    }
    if (s.setor_id) {
      await this.acoes.colocarNaFila(c, s, s.setor_id, { ator: { tipo: 'solicitante', id: s.solicitante_id }, motivo: 'nova mensagem' });
    }
  }

  private paraFluxo(a: Analise): AnaliseFluxo {
    return {
      textoBase: a.textoBase,
      resumoPt: this.textoPt(a),
      roteamento: a.roteamento,
      conhecimento: a.conhecimento,
      temMidia: Boolean(a.descricao || a.transcricao),
    };
  }

  private async avisarResponsavel(c: Ctx, s: SolicitacaoRow, a: Analise, prefixo?: string): Promise<void> {
    if (!s.responsavel_id) return;
    await this.nucleo.enfileirar(c, 'notificacao', {
      orgId: c.tx.orgId,
      pessoaId: s.responsavel_id,
      titulo: prefixo ? `${prefixo} · nova mensagem` : 'Nova mensagem',
      corpo: this.textoPt(a),
      dados: { tipo: 'mensagem', solicitacaoId: s.id },
      alta: Boolean(prefixo) || s.urgencia === 'agora',
    });
  }

  // ---------- Identificação ----------

  private async vincularPorQr(c: Ctx, s: SolicitacaoRow, codigo: string): Promise<SolicitacaoRow> {
    const l = await c.tx.client.query<{ id: string }>(
      'SELECT id FROM local WHERE unidade_id = $1 AND codigo_qr = $2 AND ativo',
      [s.unidade_id, codigo],
    );
    const local = l.rows[0];
    if (!local || !s.solicitante_id) return s;
    // O vínculo do QR vale até o checkout do hóspede ativo, ou 24 h sem lista.
    const h = await c.tx.client.query<{ checkout: string }>(
      `SELECT checkout::text FROM hospede_ativo WHERE local_id = $1 AND current_date BETWEEN checkin AND checkout
        ORDER BY checkout DESC LIMIT 1`,
      [local.id],
    );
    const fim = h.rows[0] ? new Date(`${h.rows[0].checkout}T12:00:00-03:00`) : new Date(Date.now() + 24 * 3600_000);
    await c.tx.client.query(
      `INSERT INTO vinculo (org_id, unidade_id, solicitante_id, local_id, origem, confirmado, fim)
       VALUES ($1, $2, $3, $4, 'qr', false, $5)`,
      [c.tx.orgId, s.unidade_id, s.solicitante_id, local.id, fim],
    );
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'vinculo_qr', atorTipo: 'solicitante', atorId: s.solicitante_id, dados: { localId: local.id } });
    if (s.local_id === local.id) return s;
    return this.acoes.atualizar(c, s, { local_id: local.id, identificado: false });
  }
}
