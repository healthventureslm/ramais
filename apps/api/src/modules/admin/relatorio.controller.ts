import { Controller, Get, Query } from '@nestjs/common';
import { SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Uuid } from '../../infra/validacao.js';
import { exigirGestao } from './guarda.js';

const num = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v)));
const dinheiro = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Período atual (`$2` dias até agora) ou o anterior, do mesmo tamanho, logo antes. */
const PERIODO = {
  atual: `s.criado_em > now() - make_interval(days => $2)`,
  anterior: `s.criado_em > now() - make_interval(days => $2 * 2) AND s.criado_em <= now() - make_interval(days => $2)`,
};

/**
 * Dashboard do período: volume, rapidez, satisfação, quem atende, a escada, o que a IA resolveu
 * e quanto a IA custou. Cada número vem com o do período anterior, para comparar.
 * Conversas do simulador não entram.
 */
@Controller('admin/relatorio')
export class RelatorioController {
  constructor(private readonly nucleo: Nucleo) {}

  private async geral(c: Ctx, unidadeId: string, dias: number, periodo: keyof typeof PERIODO) {
    const l = (
      await c.tx.client.query(
        `SELECT count(*) FILTER (WHERE s.origem = 'externa')::int AS pedidos,
                count(*) FILTER (WHERE s.origem = 'interna')::int AS apoios,
                count(*) FILTER (WHERE s.origem = 'externa' AND EXISTS (
                  SELECT 1 FROM evento e WHERE e.solicitacao_id = s.id AND e.tipo = 'resposta_automatica'))::int AS pela_ia,
                count(*) FILTER (WHERE s.supervisor_notificado_em IS NOT NULL)::int AS escalados,
                count(*) FILTER (WHERE s.estado IN ('automacao', 'na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante'))::int AS abertos,
                count(*) FILTER (WHERE s.resolvida_em IS NOT NULL)::int AS resolvidos,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM s.primeira_resposta_em - s.criado_em))
                  FILTER (WHERE s.primeira_resposta_em IS NOT NULL) AS primeira_resposta_p50,
                percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM s.primeira_resposta_em - s.criado_em))
                  FILTER (WHERE s.primeira_resposta_em IS NOT NULL) AS primeira_resposta_p90,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM s.resolvida_em - s.criado_em))
                  FILTER (WHERE s.resolvida_em IS NOT NULL) AS resolucao_p50
           FROM solicitacao s WHERE s.unidade_id = $1 AND NOT s.teste AND ${PERIODO[periodo]}`,
        [unidadeId, dias],
      )
    ).rows[0];
    const custo = (
      await c.tx.client.query(
        `SELECT coalesce(sum(u.custo_usd), 0) AS usd
           FROM uso_ia u LEFT JOIN solicitacao s ON s.id = u.solicitacao_id
          WHERE coalesce(u.unidade_id, s.unidade_id) = $1 AND (s.id IS NULL OR NOT s.teste)
            AND ${PERIODO[periodo].replaceAll('s.criado_em', 'u.criado_em')}`,
        [unidadeId, dias],
      )
    ).rows[0];
    return {
      pedidos: l.pedidos as number,
      apoios: l.apoios as number,
      pelaIa: l.pela_ia as number,
      escalados: l.escalados as number,
      abertos: l.abertos as number,
      resolvidos: l.resolvidos as number,
      primeiraRespostaP50: num(l.primeira_resposta_p50),
      primeiraRespostaP90: num(l.primeira_resposta_p90),
      resolucaoP50: num(l.resolucao_p50),
      custoIaUsd: dinheiro(custo.usd),
    };
  }

  @Get()
  ver(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string, @Query('dias') diasQ = '7') {
    const dias = Math.min(90, Math.max(1, Number(diasQ) || 7));
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirGestao(c, s);
      const fuso = (await c.tx.client.query('SELECT fuso FROM unidade WHERE id = $1', [unidadeId])).rows[0]?.fuso ?? 'America/Sao_Paulo';
      const base = `FROM solicitacao s WHERE s.unidade_id = $1 AND NOT s.teste AND ${PERIODO.atual}`;
      const p = [unidadeId, dias];

      const atual = await this.geral(c, unidadeId, dias, 'atual');
      const anterior = await this.geral(c, unidadeId, dias, 'anterior');

      const aceite = (
        await c.tx.client.query(
          `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM o.respondida_em - o.ofertada_em))
                    FILTER (WHERE o.resultado = 'aceita') AS p50,
                  count(*) FILTER (WHERE o.resultado = 'expirada')::int AS expiradas,
                  count(*) FILTER (WHERE o.resultado = 'recusada')::int AS recusadas,
                  count(*)::int AS ofertas
             FROM oferta o JOIN solicitacao s ON s.id = o.solicitacao_id
            WHERE s.unidade_id = $1 AND NOT s.teste AND o.ofertada_em > now() - make_interval(days => $2)
              AND o.resultado IN ('aceita', 'expirada', 'recusada')`,
          p,
        )
      ).rows[0];

      const setores = await c.tx.client.query(
        `SELECT st.nome,
                count(s.id)::int AS pedidos,
                count(s.id) FILTER (WHERE s.supervisor_notificado_em IS NOT NULL)::int AS escalados,
                count(s.id) FILTER (WHERE s.resolvida_em IS NOT NULL)::int AS resolvidos,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM s.primeira_resposta_em - s.criado_em))
                  FILTER (WHERE s.primeira_resposta_em IS NOT NULL) AS primeira_resposta_p50,
                percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM s.primeira_resposta_em - s.criado_em))
                  FILTER (WHERE s.primeira_resposta_em IS NOT NULL) AS primeira_resposta_p90,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM s.resolvida_em - s.criado_em))
                  FILTER (WHERE s.resolvida_em IS NOT NULL) AS resolucao_p50,
                (SELECT avg((e.dados->>'nota')::int) FROM evento e JOIN solicitacao s2 ON s2.id = e.solicitacao_id
                  WHERE e.tipo = 'pesquisa_respondida' AND s2.setor_id = st.id AND NOT s2.teste
                    AND e.criado_em > now() - make_interval(days => $2)) AS nota
           FROM setor st
           LEFT JOIN solicitacao s ON s.setor_id = st.id AND NOT s.teste AND ${PERIODO.atual}
          WHERE st.unidade_id = $1 AND st.ativo
          GROUP BY st.id, st.nome ORDER BY count(s.id) DESC, st.nome`,
        p,
      );

      // Quem atende: o responsável final de cada pedido, quantas respostas mandou e quantas conversas assumiu.
      const pessoas = await c.tx.client.query(
        `WITH sol AS (SELECT s.* ${base})
         SELECT p.id, p.nome,
                count(DISTINCT sol.id)::int AS atendimentos,
                count(DISTINCT sol.id) FILTER (WHERE sol.resolvida_em IS NOT NULL)::int AS resolvidos,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM sol.primeira_resposta_em - sol.criado_em))
                  FILTER (WHERE sol.primeira_resposta_em IS NOT NULL) AS primeira_resposta_p50,
                (SELECT count(*) FROM mensagem m JOIN solicitacao s2 ON s2.id = m.solicitacao_id
                  WHERE m.autor_pessoa_id = p.id AND m.visibilidade = 'externa' AND s2.unidade_id = $1 AND NOT s2.teste
                    AND m.criado_em > now() - make_interval(days => $2))::int AS respostas,
                (SELECT count(*) FROM evento e JOIN solicitacao s3 ON s3.id = e.solicitacao_id
                  WHERE e.tipo = 'assumida' AND e.ator_id = p.id AND s3.unidade_id = $1
                    AND e.criado_em > now() - make_interval(days => $2))::int AS assumidos,
                (SELECT avg((e.dados->>'nota')::int) FROM evento e JOIN sol s4 ON s4.id = e.solicitacao_id
                  WHERE e.tipo = 'pesquisa_respondida' AND s4.responsavel_id = p.id) AS nota
           FROM sol JOIN pessoa p ON p.id = sol.responsavel_id
          GROUP BY p.id, p.nome
          ORDER BY count(DISTINCT sol.id) DESC, p.nome LIMIT 50`,
        p,
      );

      const notas = await c.tx.client.query<{ nota: number; n: number }>(
        `SELECT (e.dados->>'nota')::int AS nota, count(*)::int AS n
           FROM evento e JOIN solicitacao s ON s.id = e.solicitacao_id
          WHERE e.tipo = 'pesquisa_respondida' AND s.unidade_id = $1 AND NOT s.teste
            AND e.criado_em > now() - make_interval(days => $2)
          GROUP BY 1 ORDER BY 1`,
        p,
      );
      const totalNotas = notas.rows.reduce((a, x) => a + x.n, 0);

      const idiomas = await c.tx.client.query(
        `SELECT s.idioma, count(*)::int AS n ${base} AND s.origem = 'externa' GROUP BY s.idioma ORDER BY n DESC`,
        p,
      );

      const canais = await c.tx.client.query<{ canal: string; n: number }>(
        `SELECT coalesce(cw.tipo, 'whatsapp') AS canal, count(*)::int AS n
           FROM solicitacao s LEFT JOIN canal_whatsapp cw ON cw.id = s.canal_id
          WHERE s.unidade_id = $1 AND NOT s.teste AND ${PERIODO.atual} AND s.origem = 'externa'
          GROUP BY 1`,
        p,
      );

      // O que chega e o que sai: texto, áudio e foto do hóspede; respostas da equipe e automáticas.
      const mensagens = (
        await c.tx.client.query(
          `SELECT count(*) FILTER (WHERE m.autor_tipo = 'solicitante')::int AS do_hospede,
                  count(*) FILTER (WHERE m.autor_tipo = 'solicitante' AND m.tipo = 'texto')::int AS texto,
                  count(*) FILTER (WHERE m.autor_tipo = 'solicitante' AND m.tipo = 'audio')::int AS audio,
                  count(*) FILTER (WHERE m.autor_tipo = 'solicitante' AND m.tipo = 'imagem')::int AS foto,
                  count(*) FILTER (WHERE m.autor_tipo = 'pessoa' AND m.visibilidade = 'externa')::int AS da_equipe,
                  count(*) FILTER (WHERE m.autor_tipo IN ('ia', 'sistema') AND m.visibilidade = 'externa')::int AS automaticas,
                  count(*) FILTER (WHERE m.visibilidade = 'interna')::int AS notas,
                  count(*) FILTER (WHERE m.status_envio = 'falhou')::int AS falharam
             FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id
            WHERE s.unidade_id = $1 AND NOT s.teste AND m.criado_em > now() - make_interval(days => $2)`,
          p,
        )
      ).rows[0];

      // Todos os dias do período, inclusive os sem pedido, por canal (senão o gráfico encolhe os buracos).
      const porDia = await c.tx.client.query(
        `WITH n AS (SELECT (s.criado_em AT TIME ZONE $3)::date AS dia,
                           count(*) FILTER (WHERE coalesce(cw.tipo, 'whatsapp') = 'whatsapp')::int AS whatsapp,
                           count(*) FILTER (WHERE cw.tipo = 'web')::int AS web
                      FROM solicitacao s LEFT JOIN canal_whatsapp cw ON cw.id = s.canal_id
                     WHERE s.unidade_id = $1 AND NOT s.teste AND ${PERIODO.atual} AND s.origem = 'externa'
                     GROUP BY 1),
              u AS (SELECT (u.criado_em AT TIME ZONE $3)::date AS dia, sum(u.custo_usd) AS usd
                      FROM uso_ia u LEFT JOIN solicitacao s ON s.id = u.solicitacao_id
                     WHERE coalesce(u.unidade_id, s.unidade_id) = $1 AND (s.id IS NULL OR NOT s.teste)
                       AND u.criado_em > now() - make_interval(days => $2)
                     GROUP BY 1)
         SELECT to_char(d, 'YYYY-MM-DD') AS dia, coalesce(n.whatsapp, 0) + coalesce(n.web, 0) AS n,
                coalesce(n.whatsapp, 0) AS whatsapp, coalesce(n.web, 0) AS web, coalesce(u.usd, 0) AS custo
           FROM generate_series((now() AT TIME ZONE $3)::date - ($2::int - 1), (now() AT TIME ZONE $3)::date, interval '1 day') d
           LEFT JOIN n ON n.dia = d::date
           LEFT JOIN u ON u.dia = d::date
          ORDER BY d`,
        [...p, fuso],
      );

      const porHora = await c.tx.client.query(
        `SELECT extract(hour FROM s.criado_em AT TIME ZONE $3)::int AS hora, count(*)::int AS n
           ${base} AND s.origem = 'externa' GROUP BY 1 ORDER BY 1`,
        [...p, fuso],
      );

      const escada = await c.tx.client.query<{ tipo: string; n: number }>(
        `SELECT e.tipo, count(*)::int AS n
           FROM evento e JOIN solicitacao s ON s.id = e.solicitacao_id
          WHERE s.unidade_id = $1 AND NOT s.teste AND e.criado_em > now() - make_interval(days => $2)
            AND e.tipo IN ('escalonada', 'repassada', 'lembrete_resposta', 'assumida', 'transferida', 'envio_falhou')
          GROUP BY 1`,
        p,
      );
      const contar = (tipo: string) => escada.rows.find((x) => x.tipo === tipo)?.n ?? 0;
      // A emergência marca o resumo do pedido (gatilho global, antes de qualquer fluxo).
      const emergencias = (await c.tx.client.query(`SELECT count(*)::int AS n ${base} AND s.resumo LIKE 'EMERGÊNCIA:%'`, p)).rows[0].n as number;

      const ia = (
        await c.tx.client.query(
          `SELECT count(*)::int AS decisoes,
                  count(*) FILTER (WHERE d.acao = 'encaminhar')::int AS com_certeza,
                  count(*) FILTER (WHERE d.revisao = 'confirmada')::int AS confirmadas,
                  count(*) FILTER (WHERE d.revisao = 'corrigida')::int AS corrigidas,
                  avg(d.confianca) AS confianca
             FROM decisao_ia d JOIN solicitacao s ON s.id = d.solicitacao_id
            WHERE s.unidade_id = $1 AND NOT s.teste AND d.criado_em > now() - make_interval(days => $2)
              AND d.acao IN ('encaminhar', 'encaminhar_baixa_certeza', 'recepcao')`,
          p,
        )
      ).rows[0];

      const usoIa = `FROM uso_ia u LEFT JOIN solicitacao s ON s.id = u.solicitacao_id
                     WHERE coalesce(u.unidade_id, s.unidade_id) = $1 AND (s.id IS NULL OR NOT s.teste)
                       AND u.criado_em > now() - make_interval(days => $2)`;
      const custoPorTarefa = await c.tx.client.query(
        `SELECT u.tarefa, count(*)::int AS chamadas, count(*) FILTER (WHERE NOT u.ok)::int AS falhas,
                coalesce(sum(u.custo_usd), 0) AS usd, sum(u.tokens_entrada + u.tokens_saida)::int AS tokens,
                avg(u.latencia_ms) FILTER (WHERE u.ok) AS latencia
           ${usoIa} GROUP BY u.tarefa ORDER BY coalesce(sum(u.custo_usd), 0) DESC, count(*) DESC`,
        p,
      );
      const custoPorModelo = await c.tx.client.query(
        `SELECT u.modelo, count(*)::int AS chamadas, coalesce(sum(u.custo_usd), 0) AS usd
           ${usoIa} GROUP BY u.modelo ORDER BY coalesce(sum(u.custo_usd), 0) DESC, count(*) DESC`,
        p,
      );

      return {
        dias,
        geral: {
          ...atual,
          aceiteP50: num(aceite.p50),
          ofertasExpiradas: aceite.expiradas,
          ofertasRecusadas: aceite.recusadas,
          ofertas: aceite.ofertas,
        },
        anterior,
        setores: setores.rows.map((l) => ({
          nome: l.nome,
          pedidos: l.pedidos,
          escalados: l.escalados,
          resolvidos: l.resolvidos,
          primeiraRespostaP50: num(l.primeira_resposta_p50),
          primeiraRespostaP90: num(l.primeira_resposta_p90),
          resolucaoP50: num(l.resolucao_p50),
          nota: l.nota === null ? null : Number(l.nota),
        })),
        pessoas: pessoas.rows.map((l) => ({
          id: l.id,
          nome: l.nome,
          atendimentos: l.atendimentos,
          resolvidos: l.resolvidos,
          respostas: l.respostas,
          assumidos: l.assumidos,
          primeiraRespostaP50: num(l.primeira_resposta_p50),
          nota: l.nota === null ? null : Number(l.nota),
        })),
        pesquisa: {
          respostas: totalNotas,
          media: totalNotas ? notas.rows.reduce((a, x) => a + x.nota * x.n, 0) / totalNotas : null,
          distribuicao: [1, 2, 3, 4, 5].map((nota) => ({ nota, n: notas.rows.find((x) => x.nota === nota)?.n ?? 0 })),
        },
        idiomas: idiomas.rows,
        canais: {
          whatsapp: canais.rows.find((x) => x.canal === 'whatsapp')?.n ?? 0,
          web: canais.rows.find((x) => x.canal === 'web')?.n ?? 0,
        },
        mensagens: {
          doHospede: mensagens.do_hospede,
          texto: mensagens.texto,
          audio: mensagens.audio,
          foto: mensagens.foto,
          daEquipe: mensagens.da_equipe,
          automaticas: mensagens.automaticas,
          notas: mensagens.notas,
          falharam: mensagens.falharam,
        },
        porDia: porDia.rows.map((l) => ({ dia: l.dia, n: l.n, whatsapp: l.whatsapp, web: l.web, custo: dinheiro(l.custo) })),
        porHora: Array.from({ length: 24 }, (_, hora) => ({ hora, n: porHora.rows.find((x) => x.hora === hora)?.n ?? 0 })),
        escada: {
          avisos: contar('escalonada'),
          lembretes: contar('lembrete_resposta'),
          repassadas: contar('repassada'),
          assumidas: contar('assumida'),
          transferidas: contar('transferida'),
          emergencias,
          enviosFalharam: contar('envio_falhou'),
        },
        ia: {
          decisoes: ia.decisoes,
          comCerteza: ia.com_certeza,
          triagemConfirmadas: ia.confirmadas,
          triagemCorrigidas: ia.corrigidas,
          confiancaMedia: ia.confianca === null ? null : Number(ia.confianca),
        },
        custo: {
          totalUsd: atual.custoIaUsd,
          porPedidoUsd: atual.pedidos ? atual.custoIaUsd / atual.pedidos : null,
          chamadas: custoPorTarefa.rows.reduce((a, l) => a + l.chamadas, 0),
          porTarefa: custoPorTarefa.rows.map((l) => ({
            tarefa: l.tarefa,
            chamadas: l.chamadas,
            falhas: l.falhas,
            usd: dinheiro(l.usd),
            tokens: l.tokens ?? 0,
            latenciaMs: num(l.latencia),
          })),
          porModelo: custoPorModelo.rows.map((l) => ({ modelo: l.modelo, chamadas: l.chamadas, usd: dinheiro(l.usd) })),
        },
      };
    });
  }
}
