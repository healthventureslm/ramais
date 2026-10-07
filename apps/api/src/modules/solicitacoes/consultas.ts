import { Injectable } from '@nestjs/common';
import type { MensagemView, SolicitacaoDetalhe, SolicitacaoResumo } from '@ramais/contracts';
import { mascararCampo, NOMES_CAMPO, removerCodigoLocal, type ValorColetado } from '@ramais/domain';
import type { CampoColeta } from '@ramais/contracts';
import type { Ctx } from '../../infra/nucleo.js';

const RESUMO_SQL = `
  SELECT s.id, s.unidade_id, s.estado, s.origem, s.pai_id, s.idioma, s.urgencia, s.baixa_certeza,
         s.supervisor_notificado_em IS NOT NULL AS escalada, s.resumo, s.entrou_fila_em, s.criado_em, s.atualizado_em,
         s.identificado, s.triagem,
         sg.id AS sug_id, sg.nome AS sug_nome, ds.confianca AS sug_conf,
         st.id AS setor_id, st.nome AS setor_nome,
         r.id AS resp_id, r.nome AS resp_nome,
         so.id AS sol_id, so.telefone AS sol_tel, so.nome AS sol_nome,
         l.id AS local_id, l.identificador AS local_ident,
         (SELECT coalesce(
                   (SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma = 'pt' LIMIT 1),
                   m.texto)
            FROM mensagem m WHERE m.solicitacao_id = s.id ORDER BY m.criado_em DESC LIMIT 1) AS ultima
    FROM solicitacao s
    LEFT JOIN setor st ON st.id = s.setor_id
    LEFT JOIN pessoa r ON r.id = s.responsavel_id
    LEFT JOIN solicitante so ON so.id = s.solicitante_id
    LEFT JOIN local l ON l.id = s.local_id
    LEFT JOIN setor sg ON sg.id = s.setor_sugerido_id
    LEFT JOIN decisao_ia ds ON ds.id = s.decisao_sugerida_id`;

function iso(d: Date | null): string | null {
  return d ? new Date(d).toISOString() : null;
}

function resumo(l: any): SolicitacaoResumo {
  return {
    id: l.id,
    unidadeId: l.unidade_id,
    estado: l.estado,
    origem: l.origem,
    paiId: l.pai_id,
    setor: l.setor_id ? { id: l.setor_id, nome: l.setor_nome } : null,
    responsavel: l.resp_id ? { id: l.resp_id, nome: l.resp_nome } : null,
    solicitante: l.sol_id ? { id: l.sol_id, telefone: l.sol_tel, nome: l.sol_nome } : null,
    local: l.local_id ? { id: l.local_id, identificador: l.local_ident, confirmado: l.identificado } : null,
    idioma: l.idioma,
    urgencia: l.urgencia,
    baixaCerteza: l.baixa_certeza,
    escalada: l.escalada,
    triagem: l.triagem && l.sug_id ? { setorSugerido: { id: l.sug_id, nome: l.sug_nome }, confianca: l.sug_conf } : null,
    resumo: l.resumo,
    ultimaMensagem: l.ultima ? removerCodigoLocal(String(l.ultima)).slice(0, 160) : null,
    entrouFilaEm: iso(l.entrou_fila_em),
    criadoEm: iso(l.criado_em)!,
    atualizadoEm: iso(l.atualizado_em)!,
  };
}

export type Filtro = 'minhas' | 'setores' | 'unidade' | 'fechadas';

@Injectable()
export class Consultas {
  async listar(c: Ctx, pessoaId: string, admin: boolean, filtro: Filtro, unidadeId?: string): Promise<SolicitacaoResumo[]> {
    // Parâmetros entram só quando usados: um $n sem uso (admin vendo a unidade) o Postgres não sabe tipar.
    const params: unknown[] = [];
    const p = (v: unknown) => `$${params.push(v)}`;
    let euP: string | null = null;
    const eu = () => (euP ??= p(pessoaId));
    const where: string[] = [];
    const abertos = `s.estado IN ('automacao', 'na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante')`;
    // Conversas do simulador nunca aparecem para a equipe.
    where.push('NOT s.teste');
    const meusSetores = () => `s.setor_id IN (SELECT setor_id FROM lotacao WHERE pessoa_id = ${eu()})`;
    if (filtro === 'minhas') {
      where.push(abertos);
      where.push(`(s.responsavel_id = ${eu()} OR EXISTS (SELECT 1 FROM oferta o WHERE o.solicitacao_id = s.id AND o.pessoa_id = ${eu()} AND o.resultado = 'pendente'))`);
    } else if (filtro === 'setores') {
      where.push(abertos, meusSetores());
    } else if (filtro === 'unidade') {
      where.push(abertos);
      if (!admin) where.push(`(${meusSetores()} OR s.setor_id IS NULL)`);
    } else {
      where.push(`s.estado IN ('resolvida', 'encerrada', 'cancelada')`, `s.atualizado_em > now() - interval '3 days'`);
      if (!admin) where.push(`(${meusSetores()} OR s.responsavel_id = ${eu()})`);
    }
    if (unidadeId) where.push(`s.unidade_id = ${p(unidadeId)}`);
    const r = await c.tx.client.query(
      `${RESUMO_SQL} WHERE ${where.join(' AND ')}
       ORDER BY (CASE s.urgencia WHEN 'agora' THEN 0 WHEN 'hoje' THEN 1 ELSE 2 END), s.atualizado_em DESC LIMIT 200`,
      params,
    );
    return r.rows.map(resumo);
  }

  async resumo(c: Ctx, id: string): Promise<SolicitacaoResumo | null> {
    const r = await c.tx.client.query(`${RESUMO_SQL} WHERE s.id = $1`, [id]);
    return r.rows[0] ? resumo(r.rows[0]) : null;
  }

  async detalhe(c: Ctx, id: string): Promise<SolicitacaoDetalhe | null> {
    const base = await this.resumo(c, id);
    if (!base) return null;
    const m = await c.tx.client.query(
      `SELECT m.*, p.nome AS autor_nome,
              (SELECT json_agg(json_build_object('tipo', d.tipo, 'idioma', d.idioma, 'texto', d.texto, 'alerta', d.alerta) ORDER BY d.criado_em)
                 FROM mensagem_derivado d WHERE d.mensagem_id = m.id) AS derivados
         FROM mensagem m LEFT JOIN pessoa p ON p.id = m.autor_pessoa_id
        WHERE m.solicitacao_id = $1 ORDER BY m.criado_em, m.id`,
      [id],
    );
    const mensagens: MensagemView[] = m.rows.map((l) => {
      const der: { tipo: string; idioma: string; texto: string; alerta: string | null }[] = l.derivados ?? [];
      const ultimo = (tipo: string, idioma?: string) =>
        [...der].reverse().find((d) => d.tipo === tipo && (!idioma || d.idioma === idioma));
      // Entrada: a tradução para a equipe é a pt. Saída: a tradução é a que foi enviada.
      const traducao = l.autor_tipo === 'solicitante' ? ultimo('traducao', 'pt') : der.find((d) => d.tipo === 'traducao' && d.idioma !== 'pt');
      return {
        id: l.id,
        autorTipo: l.autor_tipo,
        autorNome: l.autor_nome,
        visibilidade: l.visibilidade,
        tipo: l.tipo,
        // O código do QR é técnico: a equipe vê o pedido sem ele (o original segue intacto no banco).
        texto: l.autor_tipo === 'solicitante' && l.texto ? removerCodigoLocal(l.texto) : l.texto,
        idioma: l.idioma,
        traducao: traducao ? traducao.texto + (traducao.alerta ? `  ⚠ ${traducao.alerta}` : '') : null,
        transcricao: ultimo('transcricao')?.texto ?? null,
        descricao: ultimo('descricao')?.texto ?? null,
        midiaUrl: l.midia_chave ? `/midia/${l.id}` : null,
        statusEnvio: l.status_envio,
        criadoEm: new Date(l.criado_em).toISOString(),
      };
    });
    const filhos = await c.tx.client.query(`${RESUMO_SQL} WHERE s.pai_id = $1 ORDER BY s.criado_em`, [id]);
    const dec = await c.tx.client.query(
      `SELECT d.id, d.setor_escolhido, d.confianca, d.motor, d.acao FROM decisao_ia d
        WHERE d.solicitacao_id = $1 ORDER BY d.criado_em DESC LIMIT 1`,
      [id],
    );
    const d = dec.rows[0];
    const ctx = (await c.tx.client.query('SELECT contexto FROM solicitacao WHERE id = $1', [id])).rows[0]?.contexto ?? {};
    const dados: Record<string, ValorColetado> = { ...(ctx.dados ?? {}), ...(ctx.fluxo?.dados ?? {}) };
    const dadosColetados = Object.entries(dados)
      .filter(([campo]) => campo in NOMES_CAMPO)
      .map(([campo, v]) => ({ campo, rotulo: NOMES_CAMPO[campo as CampoColeta], valor: mascararCampo(campo as CampoColeta, v) }));
    return {
      ...base,
      mensagens,
      dadosColetados,
      filhos: filhos.rows.map(resumo),
      ultimaDecisao: d ? { id: d.id, setorPrevisto: d.setor_escolhido, confianca: d.confianca, motor: d.motor, acao: d.acao } : null,
    };
  }
}
