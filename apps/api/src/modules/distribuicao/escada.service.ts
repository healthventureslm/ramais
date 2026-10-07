import { Injectable } from '@nestjs/common';
import { sala, type DegrauAviso } from '@ramais/contracts';
import { escadaDoSetor, planoEscada, type PassoEscada } from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Unidades } from '../../infra/unidades.js';
import { Acoes } from '../solicitacoes/acoes.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';

const minutos = (seg: number) => (seg < 90 ? `${seg} s` : `${Math.round(seg / 60)} min`);

/**
 * Escada de escalonamento: enquanto o solicitante espera a equipe, avisa a supervisão
 * (e quem mais estiver na escada), lembra o responsável e passa a conversa adiante.
 * Idempotente: roda por temporizador, pela varredura e a cada mudança de espera; o que
 * já foi feito nesta espera não repete.
 */
@Injectable()
export class Escalonamento {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
  ) {}

  async avaliar(orgId: string, solicitacaoId: string): Promise<void> {
    await this.nucleo.executar(orgId, async (c) => {
      let s = await this.acoes.carregar(c, solicitacaoId);
      if (!s.espera_desde || s.teste || !s.setor_id) {
        if (s.escada_proxima_em) await this.acoes.atualizar(c, s, { escada_proxima_em: null });
        return;
      }
      const setor = await this.unidades.setorPorId(c.tx, s.setor_id);
      if (!setor) return;
      const cfg = await this.acoes.config(c, s);
      const escada = escadaDoSetor(cfg, setor.chave);
      const agora = new Date();
      const { devidos, proximoEm } = planoEscada(
        escada,
        { esperaDesde: s.espera_desde, atendenteDesde: s.atendente_desde, estado: s.estado, externa: s.origem === 'externa' },
        s.escada_feitos,
        agora,
      );
      const esperandoSeg = Math.round((agora.getTime() - s.espera_desde.getTime()) / 1000);
      const feitos = [...s.escada_feitos];
      let avisou = false;
      let repassar: PassoEscada | null = null;
      for (const p of devidos) {
        feitos.push(p.id);
        if (p.tipo === 'repassar') {
          repassar = p;
          break;
        }
        if (p.tipo === 'avisar') {
          await this.avisar(c, s, setor, p.degrau, p.aviso, esperandoSeg);
          avisou = true;
        } else if (p.tipo === 'avisar_solicitante') {
          await this.acoes.enviarTextoFixo(c, s, 'espera_longa');
        } else if (p.tipo === 'lembrar') {
          await this.lembrar(c, s, setor.nome, esperandoSeg);
        }
      }
      s = await this.acoes.atualizar(c, s, {
        escada_feitos: feitos,
        // Passou adiante: a espera segue e a gravação já agenda a próxima olhada.
        escada_proxima_em: repassar ? null : proximoEm,
        ...(avisou && !s.supervisor_notificado_em ? { supervisor_notificado_em: agora } : {}),
      });
      if (!repassar && proximoEm) {
        await this.nucleo.temporizador(c, { tipo: 'escada', orgId, solicitacaoId }, proximoEm);
      }
      if (repassar) await this.passarAdiante(c, s, setor.id, esperandoSeg);
    }, { trava: `escada:${solicitacaoId}` });
  }

  /** Quem o degrau chama. Fora do turno só se o degrau permitir. Nunca o próprio responsável. */
  private async destinatarios(c: Ctx, s: SolicitacaoRow, setorChave: string, aviso: DegrauAviso): Promise<{ id: string; nome: string }[]> {
    const turno = aviso.foraDoTurno
      ? 'true'
      : 'EXISTS (SELECT 1 FROM presenca pr WHERE pr.pessoa_id = p.id AND pr.fim IS NULL AND pr.unidade_id = $1)';
    const a = aviso.alvo;
    const r =
      a.tipo === 'pessoa'
        ? await c.tx.client.query<{ id: string; nome: string }>(
            `SELECT p.id, p.nome FROM pessoa p WHERE p.id = $2 AND p.ativo AND ${turno}`,
            [s.unidade_id, a.pessoaId],
          )
        : a.tipo === 'gerentes'
          ? await c.tx.client.query<{ id: string; nome: string }>(`SELECT p.id, p.nome FROM pessoa p WHERE p.gerente AND p.ativo AND ${turno}`, [
              s.unidade_id,
            ])
          : await c.tx.client.query<{ id: string; nome: string }>(
            `SELECT DISTINCT p.id, p.nome FROM lotacao l
               JOIN setor st ON st.id = l.setor_id AND st.unidade_id = $1 AND st.chave = $2
               JOIN pessoa p ON p.id = l.pessoa_id AND p.ativo
              WHERE ($3::text IS NULL OR l.papel = $3) AND ${turno}`,
            [s.unidade_id, a.setor ?? setorChave, a.tipo === 'supervisores' ? 'supervisor' : null],
          );
    return r.rows.filter((x) => x.id !== s.responsavel_id);
  }

  private async avisar(
    c: Ctx,
    s: SolicitacaoRow,
    setor: { id: string; chave: string; nome: string },
    degrau: number,
    aviso: DegrauAviso,
    esperandoSeg: number,
  ): Promise<void> {
    const pessoas = await this.destinatarios(c, s, setor.chave, aviso);
    const motivo = s.estado === 'em_atendimento' ? 'sem_resposta' : 'sem_aceite';
    const titulo = motivo === 'sem_aceite' ? `Pedido sem aceite · ${setor.nome}` : `Hóspede sem resposta · ${setor.nome}`;
    const corpo = `${s.resumo ?? 'Um pedido'} · esperando há ${minutos(esperandoSeg)}`;
    for (const p of pessoas) {
      await this.nucleo.enfileirar(c, 'notificacao', {
        orgId: c.tx.orgId,
        pessoaId: p.id,
        titulo,
        corpo,
        dados: { tipo: 'escalonamento', solicitacaoId: s.id },
        alta: true,
        foraDoTurno: aviso.foraDoTurno,
      });
    }
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir(
        pessoas.map((p) => sala.pessoa(p.id)),
        'escalonamento:supervisor',
        { solicitacaoId: s.id, setorId: setor.id, esperandoSeg, motivo, titulo },
      ),
    );
    await this.nucleo.evento(c, {
      solicitacaoId: s.id,
      tipo: 'escalonada',
      atorTipo: 'sistema',
      dados: { degrau, motivo, alvo: aviso.alvo, foraDoTurno: aviso.foraDoTurno, destinatarios: pessoas.map((p) => p.id), esperandoSeg },
    });
  }

  private async lembrar(c: Ctx, s: SolicitacaoRow, setorNome: string, esperandoSeg: number): Promise<void> {
    if (!s.responsavel_id) return;
    const texto = `${s.resumo ?? 'Um hóspede'} espera sua resposta há ${minutos(esperandoSeg)}`;
    await this.nucleo.enfileirar(c, 'notificacao', {
      orgId: c.tx.orgId,
      pessoaId: s.responsavel_id,
      titulo: `Hóspede esperando resposta · ${setorNome}`,
      corpo: texto,
      dados: { tipo: 'lembrete', solicitacaoId: s.id },
      alta: true,
    });
    const responsavel = s.responsavel_id;
    c.ef.depois(() => this.nucleo.tempoReal.emitir(sala.pessoa(responsavel), 'aviso', { texto }));
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'lembrete_resposta', atorTipo: 'sistema', dados: { pessoaId: responsavel, esperandoSeg } });
  }

  /** Sem resposta no prazo: a conversa volta para a fila do setor e vai para outra pessoa. */
  private async passarAdiante(c: Ctx, s: SolicitacaoRow, setorId: string, esperandoSeg: number): Promise<void> {
    const anterior = s.responsavel_id;
    await this.acoes.colocarNaFila(c, s, setorId, {
      ator: { tipo: 'sistema' },
      motivo: 'sem_resposta',
      excluir: anterior ? [anterior] : [],
      manterEscalonamento: true,
    });
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'repassada', atorTipo: 'sistema', dados: { de: anterior, esperandoSeg } });
    if (anterior) {
      const texto = `${s.resumo ?? 'Um atendimento'} passou para outra pessoa: ficou ${minutos(esperandoSeg)} sem resposta`;
      await this.nucleo.enfileirar(c, 'notificacao', {
        orgId: c.tx.orgId,
        pessoaId: anterior,
        titulo: 'Atendimento passado adiante',
        corpo: texto,
        dados: { tipo: 'repassada', solicitacaoId: s.id },
        alta: false,
      });
      c.ef.depois(() => this.nucleo.tempoReal.emitir(sala.pessoa(anterior), 'aviso', { texto }));
    }
  }
}
