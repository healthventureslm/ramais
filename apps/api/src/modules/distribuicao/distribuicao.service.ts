import { ConflictException, Injectable } from '@nestjs/common';
import { sala, type Candidato, type ItemFila } from '@ramais/contracts';
import { escadaDoSetor, ESTRATEGIAS, menorCarga, planejarDistribuicao } from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Unidades } from '../../infra/unidades.js';
import { Acoes } from '../solicitacoes/acoes.js';

/**
 * A jornada decide o quê; a distribuição decide quem. Nada aqui passa por IA.
 * Provedor de disponibilidade do MVP: presença (quem entrou no turno no app ou na web).
 */
@Injectable()
export class Distribuicao {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
  ) {}

  /** Candidatos do setor: presença aberta na unidade + lotação, com carga somada entre setores. */
  async candidatos(c: Ctx, setorId: string, unidadeId: string): Promise<Candidato[]> {
    const r = await c.tx.client.query(
      `SELECT l.pessoa_id, l.recebe, l.papel, l.limite_carga, p.idiomas,
              (SELECT count(*)::int FROM solicitacao s
                WHERE s.responsavel_id = l.pessoa_id AND s.estado IN ('em_atendimento', 'aguardando_solicitante'))
            + (SELECT count(*)::int FROM oferta o WHERE o.pessoa_id = l.pessoa_id AND o.resultado = 'pendente') AS carga,
              (SELECT max(o.ofertada_em) FROM oferta o WHERE o.pessoa_id = l.pessoa_id) AS ultima_oferta_em
         FROM lotacao l
         JOIN pessoa p ON p.id = l.pessoa_id AND p.ativo
         JOIN presenca pr ON pr.pessoa_id = l.pessoa_id AND pr.fim IS NULL AND pr.unidade_id = $2
        WHERE l.setor_id = $1`,
      [setorId, unidadeId],
    );
    return r.rows.map((l) => ({
      pessoaId: l.pessoa_id,
      recebe: l.recebe,
      papel: l.papel,
      carga: l.carga,
      limiteCarga: l.limite_carga,
      idiomas: l.idiomas,
      ultimaOfertaEm: l.ultima_oferta_em,
    }));
  }

  /** Distribui a fila inteira do setor. Chamado pelo job `distribuir`, sob lock do setor. */
  async distribuirSetor(orgId: string, setorId: string): Promise<number> {
    return this.nucleo.executar(
      orgId,
      async (c) => {
        const setor = await this.unidades.setorPorId(c.tx, setorId);
        if (!setor) return 0;
        const { cfg } = await this.unidades.versaoAtual(c.tx, setor.unidadeId);
        const fila = await c.tx.client.query(
          `SELECT s.id, s.urgencia, s.entrou_fila_em, s.idioma, s.responsavel_anterior_id,
                  coalesce((SELECT array_agg(o.pessoa_id) FROM oferta o
                             WHERE o.solicitacao_id = s.id AND o.resultado IN ('expirada', 'recusada')), '{}')
                    || s.excluir_distribuicao AS excluir
             FROM solicitacao s
            WHERE s.setor_id = $1 AND s.estado = 'na_fila' AND NOT s.teste
            ORDER BY s.entrou_fila_em
            FOR UPDATE OF s SKIP LOCKED`,
          [setorId],
        );
        if (fila.rows.length === 0) return 0;
        const itens: ItemFila[] = fila.rows.map((l) => ({
          solicitacaoId: l.id,
          urgencia: l.urgencia,
          entrouFilaEm: l.entrou_fila_em ?? new Date(),
          idioma: l.idioma,
          excluir: l.excluir,
          preferir: l.responsavel_anterior_id,
        }));
        const candidatos = await this.candidatos(c, setorId, setor.unidadeId);
        const estrategia = ESTRATEGIAS[setor.politicaDistribuicao] ?? menorCarga;
        let plano = planejarDistribuicao(itens, candidatos, estrategia);
        // Todo mundo já deixou expirar? Recomeça a rodada em vez de travar a fila.
        if (plano.ofertas.length === 0 && candidatos.length > 0) {
          plano = planejarDistribuicao(itens.map((i) => ({ ...i, excluir: [] })), candidatos, estrategia);
        }
        const expiraEm = new Date(Date.now() + escadaDoSetor(cfg, setor.chave).ofertaSegundos * 1000);
        for (const o of plano.ofertas) {
          const s = await this.acoes.carregar(c, o.solicitacaoId);
          if (s.estado !== 'na_fila') continue;
          const ins = await c.tx.client.query<{ id: string }>(
            `INSERT INTO oferta (org_id, solicitacao_id, pessoa_id, expira_em) VALUES ($1, $2, $3, $4) RETURNING id`,
            [orgId, s.id, o.pessoaId, expiraEm],
          );
          const ofertaId = ins.rows[0]!.id;
          await this.acoes.transicionar(c, s, 'ofertar');
          await this.nucleo.temporizador(c, { tipo: 'oferta_expira', orgId, ofertaId }, expiraEm);
          await this.nucleo.enfileirar(c, 'notificacao', {
            orgId,
            pessoaId: o.pessoaId,
            titulo: s.urgencia === 'agora' ? `URGENTE · ${setor.nome}` : `Novo pedido · ${setor.nome}`,
            corpo: s.resumo ?? 'Toque para ver',
            dados: { tipo: 'oferta', ofertaId, solicitacaoId: s.id },
            alta: true,
          });
          c.ef.depois(() =>
            this.nucleo.tempoReal.emitir(sala.pessoa(o.pessoaId), 'oferta:nova', {
              ofertaId,
              solicitacaoId: s.id,
              expiraEm: expiraEm.toISOString(),
              resumo: s.resumo,
            }),
          );
        }
        return plano.ofertas.length;
      },
      { trava: `setor:${setorId}` },
    );
  }

  /** Aceite atômico: só vale se a oferta ainda é desta pessoa, pendente e no prazo. */
  async aceitar(orgId: string, ofertaId: string, pessoaId: string): Promise<string> {
    return this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query<{ solicitacao_id: string }>(
        `UPDATE oferta SET resultado = 'aceita', respondida_em = now()
          WHERE id = $1 AND pessoa_id = $2 AND resultado = 'pendente' AND expira_em > now()
          RETURNING solicitacao_id`,
        [ofertaId, pessoaId],
      );
      const l = r.rows[0];
      if (!l) throw new ConflictException('a oferta expirou ou já foi para outra pessoa');
      const s = await this.acoes.carregar(c, l.solicitacao_id);
      await this.acoes.transicionar(c, s, 'aceitar', { responsavel_id: pessoaId });
      await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'aceita', atorTipo: 'pessoa', atorId: pessoaId });
      c.ef.depois(() =>
        this.nucleo.tempoReal.emitir(sala.pessoa(pessoaId), 'oferta:encerrada', { ofertaId, solicitacaoId: s.id, motivo: 'aceita' }),
      );
      return s.id;
    });
  }

  async recusar(orgId: string, ofertaId: string, pessoaId: string): Promise<void> {
    await this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query<{ id: string }>(
        `UPDATE oferta SET resultado = 'recusada', respondida_em = now()
          WHERE id = $1 AND pessoa_id = $2 AND resultado = 'pendente' RETURNING id`,
        [ofertaId, pessoaId],
      );
      if (!r.rows[0]) throw new ConflictException('oferta não está mais pendente');
      await this.devolverAFila(c, ofertaId, 'recusada');
    });
  }

  /**
   * "Pegar" do supervisor: atômico. Se dois clicam juntos, só um ganha; quem tinha
   * a oferta é avisado.
   */
  async pegar(orgId: string, solicitacaoId: string, pessoaId: string): Promise<void> {
    await this.nucleo.executar(orgId, async (c) => {
      const s = await this.acoes.carregar(c, solicitacaoId);
      if (s.estado !== 'na_fila' && s.estado !== 'oferecida') {
        throw new ConflictException('outra pessoa já pegou este atendimento');
      }
      await this.acoes.cancelarOfertas(c, s.id, 'pega');
      await this.acoes.transicionar(c, s, 'pegar', { responsavel_id: pessoaId });
      await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'pega', atorTipo: 'pessoa', atorId: pessoaId });
    });
  }

  /** Temporizador: a oferta venceu sem aceite. */
  async ofertaExpirou(orgId: string, ofertaId: string): Promise<void> {
    await this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query<{ id: string }>(
        `UPDATE oferta SET resultado = 'expirada', respondida_em = now()
          WHERE id = $1 AND resultado = 'pendente' AND expira_em <= now() + interval '1 second' RETURNING id`,
        [ofertaId],
      );
      if (!r.rows[0]) return; // aceita, cancelada ou já tratada: o temporizador só é invalidado
      await this.devolverAFila(c, ofertaId, 'expirada');
    });
  }

  /**
   * Oferta vencida ou recusada: volta para a fila e vai para outra pessoa do setor.
   * Quem chama supervisão é a escada, pelo tempo de espera (Escalonamento).
   */
  private async devolverAFila(c: Ctx, ofertaId: string, motivo: 'expirada' | 'recusada'): Promise<void> {
    const o = await c.tx.client.query<{ solicitacao_id: string; pessoa_id: string }>(
      'SELECT solicitacao_id, pessoa_id FROM oferta WHERE id = $1',
      [ofertaId],
    );
    const { solicitacao_id: solicitacaoId, pessoa_id: pessoaId } = o.rows[0]!;
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir(sala.pessoa(pessoaId), 'oferta:encerrada', {
        ofertaId,
        solicitacaoId,
        motivo: motivo === 'expirada' ? 'expirada' : 'cancelada',
      }),
    );
    let s = await this.acoes.carregar(c, solicitacaoId);
    if (s.estado !== 'oferecida') return;
    const expiracoes = s.expiracoes + 1;
    s = await this.acoes.transicionar(c, s, 'expirar_oferta', { expiracoes });
    await this.nucleo.evento(c, { solicitacaoId, tipo: `oferta_${motivo}`, atorTipo: 'sistema', dados: { pessoaId, expiracoes } });
    if (s.setor_id) await this.nucleo.distribuir(c, s.setor_id);
  }

  /** Emergência: avisa todos os supervisores da unidade, em qualquer setor. */
  async alertarEmergencia(c: Ctx, unidadeId: string, solicitacaoId: string, resumo: string | null): Promise<void> {
    const sup = await c.tx.client.query<{ pessoa_id: string }>(
      `SELECT DISTINCT l.pessoa_id FROM lotacao l
         JOIN setor s ON s.id = l.setor_id AND s.unidade_id = $1
         JOIN presenca p ON p.pessoa_id = l.pessoa_id AND p.fim IS NULL AND p.unidade_id = $1
        WHERE l.papel = 'supervisor'`,
      [unidadeId],
    );
    for (const x of sup.rows) {
      await this.nucleo.enfileirar(c, 'notificacao', {
        orgId: c.tx.orgId,
        pessoaId: x.pessoa_id,
        titulo: 'EMERGÊNCIA',
        corpo: resumo ?? 'Um hóspede relatou uma emergência',
        dados: { tipo: 'emergencia', solicitacaoId },
        alta: true,
      });
    }
    c.ef.depois(() =>
      this.nucleo.tempoReal.emitir(sala.unidade(unidadeId), 'aviso', { texto: `Emergência: ${resumo ?? 'ver painel'}` }),
    );
  }
}
