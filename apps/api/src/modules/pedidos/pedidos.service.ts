import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CatalogoItemView, JanelaHorario, PedidoReq, PedidoView } from '@ramais/contracts';
import { dataLocal, horariosLivres, idiomaDoOriginal, instanteLocal, totalDoPedido, vagasDoPedido, type ItemAgendavel } from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Unidades } from '../../infra/unidades.js';
import { Acoes } from '../solicitacoes/acoes.js';
import { Comandos } from '../solicitacoes/comandos.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';

interface ItemRow {
  id: string;
  unidade_id: string;
  setor_id: string;
  setor_nome: string;
  tipo: 'compra' | 'agendamento';
  categoria: string;
  nome: string;
  descricao: string;
  nomes: { es?: string; en?: string };
  descricoes: { es?: string; en?: string };
  preco_centavos: number | null;
  por_pessoa: boolean;
  max_quantidade: number;
  duracao_min: number | null;
  capacidade: number | null;
  vagas_por: 'pessoa' | 'pedido';
  horarios: JanelaHorario[];
  antecedencia_min: number;
  dias_a_frente: number;
  ativo: boolean;
  ordem: number;
}

interface PedidoRow {
  id: string;
  unidade_id: string;
  item_id: string;
  solicitacao_id: string;
  local_id: string | null;
  item_nome: string;
  tipo: 'compra' | 'agendamento';
  quantidade: number;
  agendado_para: Date | null;
  duracao_min: number | null;
  observacao: string | null;
  preco_unit_centavos: number | null;
  total_centavos: number | null;
  estado: PedidoView['estado'];
  motivo: string | null;
  lancado_em: Date | null;
  criado_em: Date;
  categoria?: string | null;
  setor_nome?: string | null;
  quarto?: string | null;
}

const SELECT_ITEM = `SELECT ci.*, st.nome AS setor_nome FROM catalogo_item ci JOIN setor st ON st.id = ci.setor_id`;
const SELECT_PEDIDO = `SELECT p.*, ci.categoria, st.nome AS setor_nome, l.identificador AS quarto
  FROM pedido p JOIN catalogo_item ci ON ci.id = p.item_id JOIN setor st ON st.id = ci.setor_id
  LEFT JOIN local l ON l.id = p.local_id`;

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function itemView(r: ItemRow): CatalogoItemView {
  return {
    id: r.id,
    setorId: r.setor_id,
    setorNome: r.setor_nome,
    tipo: r.tipo,
    categoria: r.categoria,
    nome: r.nome,
    descricao: r.descricao,
    nomes: r.nomes ?? {},
    descricoes: r.descricoes ?? {},
    precoCentavos: r.preco_centavos,
    porPessoa: r.por_pessoa,
    maxQuantidade: r.max_quantidade,
    duracaoMin: r.duracao_min,
    capacidade: r.capacidade,
    vagasPor: r.vagas_por,
    horarios: r.horarios ?? [],
    antecedenciaMin: r.antecedencia_min,
    diasAFrente: r.dias_a_frente,
    ativo: r.ativo,
    ordem: r.ordem,
  };
}

function pedidoView(r: PedidoRow): PedidoView {
  return {
    id: r.id,
    solicitacaoId: r.solicitacao_id,
    itemId: r.item_id,
    itemNome: r.item_nome,
    categoria: r.categoria ?? null,
    setorNome: r.setor_nome ?? null,
    tipo: r.tipo,
    quantidade: r.quantidade,
    agendadoPara: r.agendado_para ? new Date(r.agendado_para).toISOString() : null,
    duracaoMin: r.duracao_min,
    observacao: r.observacao,
    precoUnitCentavos: r.preco_unit_centavos,
    totalCentavos: r.total_centavos,
    estado: r.estado,
    motivo: r.motivo,
    lancadoEm: r.lancado_em ? new Date(r.lancado_em).toISOString() : null,
    quarto: r.quarto ?? null,
    criadoEm: new Date(r.criado_em).toISOString(),
  };
}

const agendavel = (r: ItemRow): ItemAgendavel => ({
  horarios: r.horarios ?? [],
  duracaoMin: r.duracao_min ?? 60,
  capacidade: r.capacidade,
  vagasPor: r.vagas_por,
  antecedenciaMin: r.antecedencia_min,
  diasAFrente: r.dias_a_frente,
});

/** "sex. 10/10 às 15:00" no relógio do hotel, no idioma de quem lê (pt, es ou en). */
function quando(instante: Date, fuso: string, idioma: 'pt' | 'es' | 'en'): string {
  const locale = idioma === 'pt' ? 'pt-BR' : idioma === 'es' ? 'es-ES' : 'en-GB';
  const dia = new Intl.DateTimeFormat(locale, { timeZone: fuso, weekday: 'short', day: '2-digit', month: '2-digit' }).format(instante);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instante);
  return `${dia} ${idioma === 'pt' ? 'às' : idioma === 'es' ? 'a las' : 'at'} ${hora}`;
}

/** Resumo do pedido para quem lê: "2× Club sandwich" ou "Massagem, sex. 10/10 às 15:00, 2 pessoas". */
function resumo(
  p: { tipo: 'compra' | 'agendamento'; quantidade: number; agendadoPara: Date | null },
  nome: string,
  fuso: string,
  idioma: 'pt' | 'es' | 'en',
): string {
  if (p.tipo === 'compra') return `${p.quantidade}× ${nome}`;
  const pessoas = { pt: ['pessoa', 'pessoas'], es: ['persona', 'personas'], en: ['person', 'people'] }[idioma];
  return `${nome}, ${quando(p.agendadoPara!, fuso, idioma)}, ${p.quantidade} ${pessoas[p.quantidade === 1 ? 0 : 1]}`;
}

const nomeNo = (i: ItemRow, idioma: 'pt' | 'es' | 'en') => (idioma === 'pt' ? i.nome : (i.nomes?.[idioma] ?? i.nome));

/**
 * Catálogo do hotel e pedidos do hóspede. O pedido é um atendimento no setor que entrega
 * (fila, oferta, escada, tudo como um pedido escrito), com os detalhes à parte: item, quantidade,
 * horário e valor. A equipe confirma ou recusa, lança na conta do quarto e conclui.
 */
@Injectable()
export class Pedidos {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly comandos: Comandos,
    private readonly unidades: Unidades,
  ) {}

  // ---------- Catálogo ----------

  async itens(c: Ctx, unidadeId: string, soAtivos: boolean): Promise<CatalogoItemView[]> {
    const r = await c.tx.client.query<ItemRow>(
      `${SELECT_ITEM} WHERE ci.unidade_id = $1 ${soAtivos ? 'AND ci.ativo AND st.ativo' : ''} ORDER BY ci.categoria, ci.ordem, ci.nome`,
      [unidadeId],
    );
    return r.rows.map(itemView);
  }

  private async item(c: Ctx, id: string, unidadeId: string): Promise<ItemRow> {
    const r = await c.tx.client.query<ItemRow>(`${SELECT_ITEM} WHERE ci.id = $1 AND ci.unidade_id = $2`, [id, unidadeId]);
    if (!r.rows[0]) throw new NotFoundException('item não encontrado');
    return r.rows[0];
  }

  private async fuso(c: Ctx, unidadeId: string): Promise<string> {
    return (await this.unidades.versaoAtual(c.tx, unidadeId)).fuso;
  }

  private async ocupacoes(c: Ctx, itemId: string, data: string, fuso: string) {
    const ini = instanteLocal(data, '00:00', fuso);
    const r = await c.tx.client.query<{ agendado_para: Date; duracao_min: number | null; vagas: number }>(
      `SELECT agendado_para, duracao_min, vagas FROM pedido
        WHERE item_id = $1 AND estado IN ('pendente', 'confirmado') AND agendado_para >= $2::timestamptz - interval '1 day' AND agendado_para < $2::timestamptz + interval '2 days'`,
      [itemId, ini],
    );
    return r.rows.map((o) => ({ inicio: new Date(o.agendado_para), duracaoMin: o.duracao_min ?? 60, vagas: o.vagas }));
  }

  /** Horários livres de um item num dia (relógio do hotel), para o tamanho do grupo. */
  async horarios(c: Ctx, unidadeId: string, itemId: string, data: string, pessoas: number) {
    const i = await this.item(c, itemId, unidadeId);
    if (i.tipo !== 'agendamento' || !i.ativo) return [];
    const fuso = await this.fuso(c, unidadeId);
    return horariosLivres(agendavel(i), data, fuso, new Date(), await this.ocupacoes(c, i.id, data, fuso), pessoas).map((h) => ({
      hora: h.hora,
      livres: h.livres,
    }));
  }

  // ---------- Hóspede ----------

  /**
   * O hóspede pede pelo chat do quarto. Abre um atendimento já na fila do setor do item; se ele
   * estiver falando com outro setor, a conversa continua lá (o pedido corre em paralelo).
   */
  async criarDoHospede(p: {
    orgId: string;
    unidadeId: string;
    localId: string;
    canalId: string;
    naoAntesDe: string;
    req: PedidoReq;
  }): Promise<PedidoView> {
    const telefone = `quarto:${p.localId}`;
    return this.nucleo.executar(
      p.orgId,
      async (c) => {
        const i = await this.item(c, p.req.itemId, p.unidadeId);
        if (!i.ativo) throw new ConflictException('este item não está disponível');
        if (p.req.quantidade > i.max_quantidade) throw new BadRequestException(`no máximo ${i.max_quantidade}`);
        const fuso = await this.fuso(c, p.unidadeId);
        let agendadoPara: Date | null = null;
        if (i.tipo === 'agendamento') {
          if (!p.req.data || !p.req.hora) throw new BadRequestException('escolha o dia e o horário');
          // Uma reserva por vez neste item: a última vaga não sai para duas pessoas.
          await c.tx.client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [i.id]);
          const livres = horariosLivres(agendavel(i), p.req.data, fuso, new Date(), await this.ocupacoes(c, i.id, p.req.data, fuso), p.req.quantidade);
          const h = livres.find((x) => x.hora === p.req.hora);
          if (!h) throw new ConflictException('este horário acabou de ser ocupado; escolha outro');
          agendadoPara = h.instante;
        }

        const sol = await c.tx.client.query<{ id: string }>(
          `INSERT INTO solicitante (org_id, telefone, nome) SELECT $1, $2, 'Quarto ' || l.identificador FROM local l WHERE l.id = $3
           ON CONFLICT (org_id, telefone) DO UPDATE SET nome = coalesce(solicitante.nome, EXCLUDED.nome) RETURNING id`,
          [p.orgId, telefone, p.localId],
        );
        const solicitanteId = sol.rows[0]!.id;
        // Com quem o hóspede está falando agora (na estadia atual).
        const ult = await c.tx.client.query<SolicitacaoRow>(
          `SELECT * FROM solicitacao s WHERE s.solicitante_id = $1 AND s.unidade_id = $2 AND s.origem = 'externa' AND s.criado_em >= $3
              AND NOT EXISTS (SELECT 1 FROM solicitacao o WHERE o.id::text = s.contexto->>'paralelaDe'
                                AND o.estado NOT IN ('resolvida', 'encerrada', 'cancelada'))
            ORDER BY s.criado_em DESC LIMIT 1`,
          [solicitanteId, p.unidadeId, p.naoAntesDe],
        );
        const atual = ult.rows[0];
        const aberta = atual && ['automacao', 'na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante'].includes(atual.estado) ? atual : null;
        const idioma = atual && (atual.contexto as { idiomaDefinido?: boolean }).idiomaDefinido ? atual.idioma : null;
        const v = await c.tx.client.query<{ confirmado: boolean }>(
          `SELECT confirmado FROM vinculo WHERE solicitante_id = $1 AND unidade_id = $2 AND local_id = $3 AND fim > now()
            ORDER BY confirmado DESC, inicio DESC LIMIT 1`,
          [solicitanteId, p.unidadeId, p.localId],
        );
        const { id: versaoAtual } = await this.unidades.versaoAtual(c.tx, p.unidadeId);
        const ins = await c.tx.client.query<SolicitacaoRow>(
          `INSERT INTO solicitacao (org_id, unidade_id, solicitante_id, canal_id, origem, estado, etapa, jornada_versao_id,
                                    local_id, identificado, idioma, contexto)
           VALUES ($1, $2, $3, $4, 'externa', 'automacao', 'entrada', $5, $6, $7, $8, $9) RETURNING *`,
          [
            p.orgId,
            p.unidadeId,
            solicitanteId,
            p.canalId,
            versaoAtual,
            p.localId,
            v.rows[0]?.confirmado ?? false,
            idioma ?? 'pt',
            JSON.stringify({ idiomaDefinido: Boolean(idioma), pedido: true, ...(aberta ? { paralelaDe: aberta.id } : {}) }),
          ],
        );
        let s = ins.rows[0]!;
        await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'criada', atorTipo: 'solicitante', atorId: solicitanteId, dados: { pedido: i.id } });

        const total = totalDoPedido({ tipo: i.tipo, precoCentavos: i.preco_centavos, porPessoa: i.por_pessoa }, p.req.quantidade);
        const r = await c.tx.client.query<PedidoRow>(
          `INSERT INTO pedido (org_id, unidade_id, item_id, solicitacao_id, local_id, item_nome, tipo, quantidade, agendado_para,
                               duracao_min, vagas, observacao, preco_unit_centavos, total_centavos)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
          [
            p.orgId,
            p.unidadeId,
            i.id,
            s.id,
            p.localId,
            i.nome,
            i.tipo,
            p.req.quantidade,
            agendadoPara,
            i.tipo === 'agendamento' ? (i.duracao_min ?? 60) : null,
            i.tipo === 'agendamento' ? vagasDoPedido(agendavel(i), p.req.quantidade) : 0,
            p.req.observacao || null,
            i.preco_centavos,
            total,
          ],
        );
        const pedido = r.rows[0]!;
        const dados = { tipo: i.tipo, quantidade: p.req.quantidade, agendadoPara };
        const textoPt = resumo(dados, i.nome, fuso, 'pt');
        const valor = total === null ? '' : ` · total ${brl(total)}`;
        const unit = i.preco_centavos !== null && p.req.quantidade > 1 && (i.tipo === 'compra' || i.por_pessoa) ? ` (${brl(i.preco_centavos)} cada)` : '';
        await this.acoes.notaInterna(
          c,
          s.id,
          `${i.tipo === 'compra' ? 'Pedido' : 'Reserva'} pelo chat do quarto: ${textoPt}${unit}${valor}.${p.req.observacao ? ` Observação: ${p.req.observacao}` : ''} Confirme ou recuse no cartão do pedido.`,
          { tipo: 'sistema' },
        );
        s = await this.acoes.colocarNaFila(c, s, i.setor_id, {
          ator: { tipo: 'solicitante', id: solicitanteId },
          motivo: 'pedido_catalogo',
          resumo: `${i.tipo === 'compra' ? 'Pedido' : 'Reserva'}: ${textoPt}${valor}`,
        });
        // Aviso ao hóspede no idioma dele (fora de PT/ES/EN, sai em português e a saída traduz).
        const id = idiomaDoOriginal(s.idioma);
        const oQue = resumo(dados, nomeNo(i, id), fuso, id);
        const totalTxt = total === null ? '' : { pt: ` Total: ${brl(total)}, na conta do quarto.`, es: ` Total: ${brl(total)}, en la cuenta de la habitación.`, en: ` Total: ${brl(total)}, charged to your room.` }[id];
        const recebido =
          i.tipo === 'compra'
            ? { pt: `Recebemos seu pedido: ${oQue}.${totalTxt} Avisamos aqui assim que for confirmado.`, es: `Recibimos su pedido: ${oQue}.${totalTxt} Le avisamos aquí apenas se confirme.`, en: `We got your order: ${oQue}.${totalTxt} We will let you know here as soon as it is confirmed.` }
            : { pt: `Recebemos sua reserva: ${oQue}.${totalTxt} Avisamos aqui assim que for confirmada.`, es: `Recibimos su reserva: ${oQue}.${totalTxt} Le avisamos aquí apenas se confirme.`, en: `We got your booking: ${oQue}.${totalTxt} We will let you know here as soon as it is confirmed.` };
        await this.acoes.enviarConteudo(c, s, { tipo: 'livre', texto: recebido });
        return pedidoView({ ...pedido, categoria: i.categoria, setor_nome: i.setor_nome });
      },
      { trava: `conversa:${p.canalId}:${telefone}` },
    );
  }

  /** Pedidos da estadia, para o hóspede acompanhar. */
  async doQuarto(c: Ctx, localId: string, desde: Date): Promise<PedidoView[]> {
    const r = await c.tx.client.query<PedidoRow>(`${SELECT_PEDIDO} WHERE p.local_id = $1 AND p.criado_em >= $2 ORDER BY p.criado_em DESC LIMIT 50`, [
      localId,
      desde,
    ]);
    return r.rows.map(pedidoView);
  }

  /** O hóspede desiste antes de ser atendido (pendente) ou de uma reserva confirmada que ainda não chegou. */
  async cancelarPeloHospede(c: Ctx, localId: string, desde: Date, pedidoId: string): Promise<void> {
    const p = await this.carregar(c, pedidoId);
    if (p.local_id !== localId || new Date(p.criado_em) < desde) throw new NotFoundException();
    const podia = p.estado === 'pendente' || (p.estado === 'confirmado' && p.agendado_para && new Date(p.agendado_para) > new Date());
    if (!podia) throw new ConflictException('este pedido não pode mais ser cancelado por aqui; fale com a equipe');
    await this.mudar(c, p, 'cancelado', null, null);
    const s = await this.acoes.carregar(c, p.solicitacao_id);
    await this.acoes.notaInterna(c, s.id, 'O hóspede cancelou o pedido pelo chat.', { tipo: 'sistema' });
    await this.acoes.enviarConteudo(c, s, {
      tipo: 'livre',
      texto: { pt: `Pedido cancelado: ${p.item_nome}.`, es: `Pedido cancelado: ${p.item_nome}.`, en: `Order cancelled: ${p.item_nome}.` },
    });
    await this.acoes.encerrar(c, s, { tipo: 'solicitante', id: s.solicitante_id }, 'pedido cancelado');
  }

  // ---------- Equipe ----------

  async listar(c: Ctx, unidadeId: string, filtro: 'abertos' | 'agenda' | 'todos'): Promise<PedidoView[]> {
    const onde =
      filtro === 'abertos'
        ? `AND (p.estado = 'pendente' OR (p.estado = 'confirmado' AND (p.agendado_para IS NULL OR p.agendado_para > now() - interval '6 hours')))`
        : filtro === 'agenda'
          ? `AND p.tipo = 'agendamento' AND p.estado IN ('pendente', 'confirmado') AND p.agendado_para > now() - interval '6 hours'`
          : '';
    const ordem = filtro === 'agenda' ? 'p.agendado_para' : 'p.criado_em DESC';
    const r = await c.tx.client.query<PedidoRow>(`${SELECT_PEDIDO} WHERE p.unidade_id = $1 ${onde} ORDER BY ${ordem} LIMIT 200`, [unidadeId]);
    return r.rows.map(pedidoView);
  }

  async porSolicitacao(c: Ctx, solicitacaoId: string, pessoaId: string): Promise<PedidoView | null> {
    const s = await this.acoes.carregar(c, solicitacaoId, false);
    await this.comandos.exigirAcesso(c, s, pessoaId);
    const r = await c.tx.client.query<PedidoRow>(`${SELECT_PEDIDO} WHERE p.solicitacao_id = $1`, [solicitacaoId]);
    return r.rows[0] ? pedidoView(r.rows[0]) : null;
  }

  private async carregar(c: Ctx, id: string): Promise<PedidoRow> {
    const r = await c.tx.client.query<PedidoRow>('SELECT * FROM pedido WHERE id = $1 FOR UPDATE', [id]);
    if (!r.rows[0]) throw new NotFoundException('pedido não encontrado');
    return r.rows[0];
  }

  private async mudar(c: Ctx, p: PedidoRow, estado: PedidoView['estado'], pessoaId: string | null, motivo: string | null) {
    await c.tx.client.query(
      `UPDATE pedido SET estado = $2, motivo = coalesce($3, motivo), respondido_por = coalesce($4, respondido_por), atualizado_em = now() WHERE id = $1`,
      [p.id, estado, motivo, pessoaId],
    );
    await this.nucleo.evento(c, { solicitacaoId: p.solicitacao_id, tipo: `pedido_${estado}`, atorTipo: pessoaId ? 'pessoa' : 'solicitante', atorId: pessoaId, dados: { pedido: p.id } });
    const s = await this.acoes.carregar(c, p.solicitacao_id, false);
    this.acoes.avisarAtualizacao(c, s);
  }

  /** Quem responde ao pedido fica com o atendimento (se ainda estava na fila ou oferecido). */
  private async assumir(c: Ctx, s: SolicitacaoRow, pessoaId: string): Promise<SolicitacaoRow> {
    if (s.estado !== 'na_fila' && s.estado !== 'oferecida') return s;
    await this.acoes.cancelarOfertas(c, s.id, 'pega');
    return this.acoes.transicionar(c, s, 'pegar', { responsavel_id: pessoaId });
  }

  private async contexto(c: Ctx, pedidoId: string, pessoaId: string) {
    const p = await this.carregar(c, pedidoId);
    const s = await this.acoes.carregar(c, p.solicitacao_id);
    await this.comandos.exigirAcesso(c, s, pessoaId);
    const fuso = await this.fuso(c, p.unidade_id);
    const texto = resumo({ tipo: p.tipo, quantidade: p.quantidade, agendadoPara: p.agendado_para ? new Date(p.agendado_para) : null }, p.item_nome, fuso, 'pt');
    return { p, s, texto };
  }

  /** Mensagem da equipe ao hóspede: escrita em português, sai traduzida para o idioma dele. */
  private falar(c: Ctx, s: SolicitacaoRow, texto: string, pessoaId: string) {
    return this.acoes.enviarAoSolicitante(c, s, { texto, idioma: 'pt', autor: { tipo: 'pessoa', id: pessoaId } });
  }

  async confirmar(orgId: string, pedidoId: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { p, s: s0, texto } = await this.contexto(c, pedidoId, pessoaId);
      if (p.estado !== 'pendente') throw new ConflictException('este pedido já foi respondido');
      const s = await this.assumir(c, s0, pessoaId);
      await this.mudar(c, p, 'confirmado', pessoaId, null);
      await this.acoes.notaInterna(c, s.id, 'Pedido confirmado.', { tipo: 'pessoa', id: pessoaId });
      await this.falar(c, s, p.tipo === 'compra' ? `Pedido confirmado: ${texto}. Já estamos cuidando disso.` : `Reserva confirmada: ${texto}. Até lá!`, pessoaId);
      return { ok: true };
    });
  }

  async recusar(orgId: string, pedidoId: string, pessoaId: string, motivo: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { p, s: s0, texto } = await this.contexto(c, pedidoId, pessoaId);
      if (p.estado !== 'pendente' && p.estado !== 'confirmado') throw new ConflictException('este pedido já foi encerrado');
      const s = await this.assumir(c, s0, pessoaId);
      await this.mudar(c, p, 'recusado', pessoaId, motivo);
      await this.acoes.notaInterna(c, s.id, `Pedido recusado: ${motivo}`, { tipo: 'pessoa', id: pessoaId });
      await this.falar(c, s, `Não conseguimos atender: ${texto}. ${motivo}. Se quiser, escolha outra opção no Menu principal.`, pessoaId);
      await this.acoes.encerrar(c, await this.acoes.carregar(c, s.id), { tipo: 'pessoa', id: pessoaId }, 'pedido recusado');
      return { ok: true };
    });
  }

  /** Marcar como lançado na conta do quarto (o PMS ainda é à mão). */
  async lancar(orgId: string, pedidoId: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { p, s } = await this.contexto(c, pedidoId, pessoaId);
      if (p.lancado_em) return { ok: true };
      if (p.estado === 'recusado' || p.estado === 'cancelado') throw new ConflictException('pedido recusado ou cancelado não vai para a conta');
      await c.tx.client.query('UPDATE pedido SET lancado_em = now(), atualizado_em = now() WHERE id = $1', [p.id]);
      await this.acoes.notaInterna(c, s.id, `Lançado na conta do quarto${p.total_centavos !== null ? `: ${brl(p.total_centavos)}` : ''}.`, { tipo: 'pessoa', id: pessoaId });
      this.acoes.avisarAtualizacao(c, s);
      return { ok: true };
    });
  }

  /** Entregue (compra) ou realizado (agendamento): conclui o pedido e resolve o atendimento. */
  async concluir(orgId: string, pedidoId: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { p, s: s0 } = await this.contexto(c, pedidoId, pessoaId);
      if (p.estado !== 'pendente' && p.estado !== 'confirmado') throw new ConflictException('este pedido já foi encerrado');
      const s = await this.assumir(c, s0, pessoaId);
      await this.mudar(c, p, 'concluido', pessoaId, null);
      const atual = await this.acoes.carregar(c, s.id);
      if (this.comandos.podeResolver(atual.estado)) await this.acoes.resolver(c, atual, { tipo: 'pessoa', id: pessoaId });
      return { ok: true };
    });
  }

  /** Hoje, no relógio do hotel (para a tela de agenda). */
  async hoje(c: Ctx, unidadeId: string): Promise<string> {
    return dataLocal(new Date(), await this.fuso(c, unidadeId));
  }
}
