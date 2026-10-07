import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import type { DashboardView } from '@ramais/contracts';
import { degrauAtual } from '@ramais/domain';
import { pessoaDa, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo } from '../../infra/nucleo.js';
import { Uuid } from '../../infra/validacao.js';

/**
 * Dashboard fixo do MVP, com escopo por nível: supervisor vê os setores dele; admin vê a unidade.
 * No centro, "precisa de alguém": o que espera agora, há quanto tempo, em qual degrau.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly nucleo: Nucleo) {}

  @Get()
  ver(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string): Promise<DashboardView> {
    const pessoaId = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      const eu = (
        await c.tx.client.query(
          `SELECT p.admin, p.gerente, coalesce(array_agg(l.setor_id) FILTER (WHERE l.papel = 'supervisor'), '{}') AS supervisiona,
                  coalesce(array_agg(l.setor_id), '{}') AS lotado
             FROM pessoa p LEFT JOIN lotacao l ON l.pessoa_id = p.id WHERE p.id = $1 GROUP BY p.admin, p.gerente`,
          [pessoaId],
        )
      ).rows[0];
      const escopo: string[] | null = eu.admin || eu.gerente ? null : eu.supervisiona.length ? eu.supervisiona : eu.lotado;
      if (escopo && escopo.length === 0) throw new ForbiddenException();

      const precisa = await c.tx.client.query(
        // Quem espera a equipe: sem aceite (na fila) ou sem resposta (em atendimento, hóspede esperando).
        `SELECT s.id, st.nome AS setor, s.estado, s.urgencia, s.resumo, s.expiracoes, s.escada_feitos, r.nome AS responsavel,
                extract(epoch FROM now() - coalesce(s.espera_desde, s.entrou_fila_em, s.criado_em))::int AS esperando
           FROM solicitacao s LEFT JOIN setor st ON st.id = s.setor_id LEFT JOIN pessoa r ON r.id = s.responsavel_id
          WHERE s.unidade_id = $1 AND NOT s.teste
            AND (s.estado IN ('na_fila', 'oferecida') OR (s.estado = 'em_atendimento' AND s.espera_desde IS NOT NULL))
            AND ($2::uuid[] IS NULL OR s.setor_id = ANY($2::uuid[]))
          ORDER BY (CASE s.urgencia WHEN 'agora' THEN 0 WHEN 'hoje' THEN 1 ELSE 2 END), coalesce(s.espera_desde, s.entrou_fila_em)
          LIMIT 100`,
        [unidadeId, escopo],
      );
      const setores = await c.tx.client.query(
        `SELECT st.id, st.nome,
                count(*) FILTER (WHERE s.estado = 'na_fila')::int AS na_fila,
                count(*) FILTER (WHERE s.estado IN ('na_fila', 'oferecida') AND s.expiracoes > 0)::int AS sem_aceite,
                count(*) FILTER (WHERE s.estado IN ('na_fila', 'oferecida') AND s.supervisor_notificado_em IS NOT NULL)::int AS escaladas,
                (SELECT count(DISTINCT l.pessoa_id)::int FROM lotacao l JOIN presenca p ON p.pessoa_id = l.pessoa_id AND p.fim IS NULL
                  WHERE l.setor_id = st.id) AS em_turno,
                (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM x.primeira_resposta_em - x.criado_em))
                   FROM solicitacao x WHERE x.setor_id = st.id AND x.primeira_resposta_em IS NOT NULL
                    AND x.criado_em > date_trunc('day', now())) AS mediana
           FROM setor st LEFT JOIN solicitacao s ON s.setor_id = st.id AND s.estado IN ('na_fila', 'oferecida') AND NOT s.teste
          WHERE st.unidade_id = $1 AND st.ativo AND ($2::uuid[] IS NULL OR st.id = ANY($2::uuid[]))
          GROUP BY st.id, st.nome ORDER BY st.nome`,
        [unidadeId, escopo],
      );
      const pessoas = await c.tx.client.query(
        `SELECT p.id, p.nome,
                (SELECT count(*)::int FROM solicitacao s WHERE s.responsavel_id = p.id AND s.estado IN ('em_atendimento', 'aguardando_solicitante')) AS carga
           FROM presenca pr JOIN pessoa p ON p.id = pr.pessoa_id
          WHERE pr.fim IS NULL AND pr.unidade_id = $1
            AND ($2::uuid[] IS NULL OR EXISTS (SELECT 1 FROM lotacao l WHERE l.pessoa_id = p.id AND l.setor_id = ANY($2::uuid[])))
          ORDER BY p.nome`,
        [unidadeId, escopo],
      );
      // Quem está atendendo agora, para a supervisão acompanhar e assumir se precisar.
      const atendendo = await c.tx.client.query(
        `SELECT s.id, st.nome AS setor, s.setor_id, l.identificador AS quarto, s.resumo, s.estado,
                r.id AS resp_id, r.nome AS resp_nome,
                extract(epoch FROM now() - coalesce(s.atendente_desde, s.atualizado_em))::int AS com_resp,
                CASE WHEN s.estado = 'em_atendimento' AND s.espera_desde IS NOT NULL
                     THEN extract(epoch FROM now() - s.espera_desde)::int END AS esperando
           FROM solicitacao s
           JOIN pessoa r ON r.id = s.responsavel_id
           LEFT JOIN setor st ON st.id = s.setor_id
           LEFT JOIN local l ON l.id = s.local_id
          WHERE s.unidade_id = $1 AND NOT s.teste AND s.estado IN ('em_atendimento', 'aguardando_solicitante')
            AND ($2::uuid[] IS NULL OR s.setor_id = ANY($2::uuid[]))
          ORDER BY (s.estado = 'em_atendimento' AND s.espera_desde IS NOT NULL) DESC, s.espera_desde NULLS LAST, r.nome
          LIMIT 200`,
        [unidadeId, escopo],
      );
      return {
        emAtendimento: atendendo.rows.map((l) => ({
          solicitacaoId: l.id,
          setor: l.setor,
          setorId: l.setor_id,
          quarto: l.quarto,
          resumo: l.resumo,
          responsavel: { id: l.resp_id, nome: l.resp_nome },
          comResponsavelSeg: l.com_resp,
          esperandoRespostaSeg: l.esperando,
          estado: l.estado,
        })),
        precisaDeAlguem: precisa.rows.map((l) => ({
          solicitacaoId: l.id,
          setor: l.setor,
          estado: l.estado,
          urgencia: l.urgencia,
          esperandoSeg: l.esperando,
          degrau: degrauAtual(l.expiracoes, l.escada_feitos),
          resumo: l.resumo,
          responsavel: l.estado === 'em_atendimento' ? l.responsavel : null,
        })),
        setores: setores.rows.map((l) => ({
          id: l.id,
          nome: l.nome,
          naFila: l.na_fila,
          semAceite: l.sem_aceite,
          escaladas: l.escaladas,
          emTurno: l.em_turno,
          primeiraRespostaMedianaSeg: l.mediana === null ? null : Math.round(Number(l.mediana)),
        })),
        pessoasEmTurno: pessoas.rows,
      };
    });
  }
}
