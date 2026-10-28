import { BadRequestException, ConflictException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import type { CatalogoItemView, ContaHospedeView, JanelaHorario, PedidoReq, PedidoView } from '@ramais/contracts';
import { dataLocal, horariosLivres, idiomaDoOriginal, instanteLocal, totalDoPedido, vagasDoPedido, type ItemAgendavel } from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Unidades } from '../../infra/unidades.js';
import { Cobrancas, type CobrancaRow } from '../cobrancas/cobrancas.service.js';
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
  cobranca_id?: string | null;
  cob_estado?: NonNullable<PedidoView['pagamento']>['estado'] | null;
  cob_link?: string | null;
  cob_valor?: number | null;
}

interface LinhaPronta {
  item: ItemRow;
  quantidade: number;
  agendadoPara: Date | null;
  observacao: string | null;
}

interface BaseAtendimento {
  unidadeId: string;
  solicitanteId: string;
  canalId: string | null;
  versaoId: string;
  localId: string | null;
  identificado: boolean;
  idioma: string | null;
  paralelaDe: string | null;
  /** Para a nota da equipe: "chat do quarto", "chat". */
  origem: string;
  /** Saiu do pedido montado conversando: a conversa continua com a IA até alguém pegar o pedido. */
  doCarrinho?: boolean;
}

const SELECT_ITEM = `SELECT ci.*, st.nome AS setor_nome FROM catalogo_item ci JOIN setor st ON st.id = ci.setor_id`;
const SELECT_PEDIDO = `SELECT p.*, ci.categoria, st.nome AS setor_nome, l.identificador AS quarto,
       cb.estado AS cob_estado, cb.link AS cob_link, cb.valor_centavos AS cob_valor
  FROM pedido p JOIN catalogo_item ci ON ci.id = p.item_id JOIN setor st ON st.id = ci.setor_id
  LEFT JOIN local l ON l.id = p.local_id LEFT JOIN cobranca cb ON cb.id = p.cobranca_id`;

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
    pagamento: r.cob_estado ? { estado: r.cob_estado, link: r.cob_link ?? null, valorCentavos: r.cob_valor ?? 0 } : null,
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
export class Pedidos implements OnModuleInit {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly comandos: Comandos,
    private readonly unidades: Unidades,
    private readonly cobrancas: Cobrancas,
  ) {}

  onModuleInit() {
    this.cobrancas.reagir('pedido', (c, cob, estado) => this.aoMudarCobranca(c, cob, estado));
  }

  // ---------- Pagamento por link ----------

  /**
   * Link de pagamento (Pix ou cartão) para itens do catálogo. A cobrança fica na conversa `s`
   * (onde o hóspede é avisado); os itens apontam para ela e o cartão do pedido mostra a situação.
   */
  async cobrar(c: Ctx, s: SolicitacaoRow, pedidoIds: string[], criadoPor: string | null, descricao?: string): Promise<CobrancaRow> {
    const r = await c.tx.client.query<PedidoRow>('SELECT * FROM pedido WHERE id = ANY($1::uuid[]) ORDER BY criado_em, id', [pedidoIds]);
    const fuso = await this.fuso(c, s.unidade_id);
    const comValor = r.rows.filter((p) => (p.total_centavos ?? 0) > 0);
    if (!comValor.length) throw new ConflictException('nada a cobrar: os itens não têm valor');
    const quarto = s.local_id ? (await c.tx.client.query<{ identificador: string }>('SELECT identificador FROM local WHERE id = $1', [s.local_id])).rows[0]?.identificador : null;
    const cob = await this.cobrancas.criar(c, {
      s,
      tipo: 'pedido',
      descricao: descricao ?? `${comValor.length === 1 ? 'pedido' : `pedido (${comValor.length} itens)`}${quarto ? `, quarto ${quarto}` : ''}`,
      itens: comValor.map((p) => ({
        descricao: p.tipo === 'compra' ? p.item_nome : resumo({ tipo: p.tipo, quantidade: p.quantidade, agendadoPara: p.agendado_para ? new Date(p.agendado_para) : null }, p.item_nome, fuso, 'pt'),
        quantidade: p.tipo === 'compra' ? p.quantidade : 1,
        totalCentavos: p.total_centavos!,
      })),
      criadoPor,
    });
    await c.tx.client.query('UPDATE pedido SET cobranca_id = $2, atualizado_em = now() WHERE id = ANY($1::uuid[])', [comValor.map((p) => p.id), cob.id]);
    for (const sid of new Set(comValor.map((p) => p.solicitacao_id))) {
      this.acoes.avisarAtualizacao(c, await this.acoes.carregar(c, sid, false));
    }
    return cob;
  }

  /** A equipe manda o link para o hóspede pagar o que pediu (em vez da conta do quarto). */
  async cobrarPorLink(orgId: string, pedidoId: string, pessoaId: string) {
    if (!this.cobrancas.disponivel) throw new ConflictException('pagamento online desligado (sem chave do Salabim Pay)');
    return this.nucleo.executar(orgId, async (c) => {
      const { s, todos } = await this.contexto(c, pedidoId, pessoaId);
      const pagos = todos.filter((x) => x.cobranca_id).map((x) => x.cobranca_id!);
      const ativas = pagos.length
        ? (await c.tx.client.query<{ id: string }>(`SELECT id FROM cobranca WHERE id = ANY($1::uuid[]) AND estado IN ('aguardando', 'paga')`, [pagos])).rows.map((x) => x.id)
        : [];
      const alvo = todos.filter((x) => x.estado !== 'recusado' && x.estado !== 'cancelado' && !x.lancado_em && !(x.cobranca_id && ativas.includes(x.cobranca_id)));
      if (!alvo.length) throw new ConflictException('nada a cobrar: os itens já foram pagos, lançados ou cancelados');
      const cob = await this.cobrar(c, s, alvo.map((x) => x.id), pessoaId);
      await this.falar(c, s, `Total: ${brl(cob.valor_centavos)}.\n${await this.cobrancas.textoDoLink(c, cob)}\nAssim que o pagamento cair, avisamos aqui.`, pessoaId);
      await this.acoes.notaInterna(c, s.id, `Link de pagamento enviado ao hóspede: ${brl(cob.valor_centavos)}.`, { tipo: 'pessoa', id: pessoaId });
      return { ok: true, link: cob.link };
    });
  }

  /** Pago: os setores ficam sabendo (nota e cartão atualizado). Vencido: fica na conta do quarto. */
  private async aoMudarCobranca(c: Ctx, cob: CobrancaRow, estado: string): Promise<boolean> {
    const r = await c.tx.client.query<PedidoRow>('SELECT * FROM pedido WHERE cobranca_id = $1', [cob.id]);
    const atendimentos = [...new Set(r.rows.map((p) => p.solicitacao_id))];
    const nota =
      estado === 'paga'
        ? `Pago pelo hóspede por link (Pix ou cartão): ${brl(cob.valor_centavos)}. Não lançar na conta do quarto.`
        : estado === 'expirada'
          ? `O link de pagamento venceu sem pagamento (${brl(cob.valor_centavos)}): lançar na conta do quarto.`
          : estado === 'estornada'
            ? `Pagamento por link estornado (${brl(cob.valor_centavos)}).`
            : null;
    for (const sid of atendimentos) {
      if (nota && sid !== cob.solicitacao_id) await this.acoes.notaInterna(c, sid, nota, { tipo: 'sistema' });
      // Pago o que já tinha sido lançado: o sistema do hotel precisa registrar o pagamento.
      const lancados = r.rows.filter((p) => p.solicitacao_id === sid && p.lancado_em);
      if (estado === 'paga' && lancados.length) {
        await this.acoes.notaInterna(c, sid, `Já estava lançado na conta do quarto: registre no sistema do hotel o pagamento por link (${lancados.map((p) => p.item_nome).join(', ')}).`, {
          tipo: 'sistema',
        });
      }
      this.acoes.avisarAtualizacao(c, await this.acoes.carregar(c, sid, false));
    }
    if (estado === 'expirada' && r.rows.some((p) => p.local_id)) {
      const s = await this.acoes.carregar(c, cob.solicitacao_id, false);
      await this.acoes.enviarAoSolicitante(c, s, {
        texto: `O link de pagamento venceu sem pagamento. O pedido segue normalmente e o valor (${brl(cob.valor_centavos)}) vai para a conta do quarto.`,
        idioma: 'pt',
        autor: { tipo: 'ia' },
      });
      return true;
    }
    return false;
  }

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

  /** Valida a linha e, no agendamento, trava o item e confere que o horário ainda está livre. */
  private async prepararLinha(c: Ctx, unidadeId: string, fuso: string, l: { itemId: string; quantidade: number; data?: string | null; hora?: string | null; observacao?: string | null }): Promise<LinhaPronta> {
    const i = await this.item(c, l.itemId, unidadeId);
    if (!i.ativo) throw new ConflictException(`${i.nome} não está disponível`);
    if (l.quantidade > i.max_quantidade) throw new BadRequestException(`${i.nome}: no máximo ${i.max_quantidade}`);
    let agendadoPara: Date | null = null;
    if (i.tipo === 'agendamento') {
      if (!l.data || !l.hora) throw new BadRequestException('escolha o dia e o horário');
      // Uma reserva por vez neste item: a última vaga não sai para duas pessoas.
      await c.tx.client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [i.id]);
      const livres = horariosLivres(agendavel(i), l.data, fuso, new Date(), await this.ocupacoes(c, i.id, l.data, fuso), l.quantidade);
      const h = livres.find((x) => x.hora === l.hora);
      if (!h) throw new ConflictException(`${i.nome}: este horário acabou de ser ocupado; escolha outro`);
      agendadoPara = h.instante;
    }
    return { item: i, quantidade: l.quantidade, agendadoPara, observacao: l.observacao?.trim() || null };
  }

  /**
   * Abre um atendimento no setor com os itens (do mesmo setor; agendamento vai sozinho): pedidos,
   * nota para a equipe e fila. `avisar`: manda ao hóspede o "recebemos seu pedido".
   */
  private async abrirAtendimento(c: Ctx, base: BaseAtendimento, linhas: LinhaPronta[], fuso: string, avisar: boolean): Promise<{ s: SolicitacaoRow; pedidos: PedidoView[]; total: number | null }> {
    const ins = await c.tx.client.query<SolicitacaoRow>(
      `INSERT INTO solicitacao (org_id, unidade_id, solicitante_id, canal_id, origem, estado, etapa, jornada_versao_id,
                                local_id, identificado, idioma, contexto)
       VALUES ($1, $2, $3, $4, 'externa', 'automacao', 'entrada', $5, $6, $7, $8, $9) RETURNING *`,
      [
        c.tx.orgId,
        base.unidadeId,
        base.solicitanteId,
        base.canalId,
        base.versaoId,
        base.localId,
        base.identificado,
        base.idioma ?? 'pt',
        JSON.stringify({
          idiomaDefinido: Boolean(base.idioma),
          pedido: true,
          ...(base.paralelaDe ? { paralelaDe: base.paralelaDe } : {}),
          ...(base.doCarrinho ? { doCarrinho: true } : {}),
        }),
      ],
    );
    let s = ins.rows[0]!;
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'criada', atorTipo: 'solicitante', atorId: base.solicitanteId, dados: { pedidos: linhas.map((l) => l.item.id) } });
    const pedidos: PedidoView[] = [];
    let soma: number | null = null;
    const notas: string[] = [];
    for (const l of linhas) {
      const i = l.item;
      const total = totalDoPedido({ tipo: i.tipo, precoCentavos: i.preco_centavos, porPessoa: i.por_pessoa }, l.quantidade);
      if (total !== null) soma = (soma ?? 0) + total;
      const r = await c.tx.client.query<PedidoRow>(
        `INSERT INTO pedido (org_id, unidade_id, item_id, solicitacao_id, local_id, item_nome, tipo, quantidade, agendado_para,
                             duracao_min, vagas, observacao, preco_unit_centavos, total_centavos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          c.tx.orgId,
          base.unidadeId,
          i.id,
          s.id,
          base.localId,
          i.nome,
          i.tipo,
          l.quantidade,
          l.agendadoPara,
          i.tipo === 'agendamento' ? (i.duracao_min ?? 60) : null,
          i.tipo === 'agendamento' ? vagasDoPedido(agendavel(i), l.quantidade) : 0,
          l.observacao,
          i.preco_centavos,
          total,
        ],
      );
      pedidos.push(pedidoView({ ...r.rows[0]!, categoria: i.categoria, setor_nome: i.setor_nome }));
      const unit = i.preco_centavos !== null && l.quantidade > 1 && (i.tipo === 'compra' || i.por_pessoa) ? ` (${brl(i.preco_centavos)} cada)` : '';
      notas.push(`${resumo({ tipo: i.tipo, quantidade: l.quantidade, agendadoPara: l.agendadoPara }, i.nome, fuso, 'pt')}${unit}${total !== null ? ` = ${brl(total)}` : ''}${l.observacao ? `, observação: ${l.observacao}` : ''}`);
    }
    const reserva = linhas[0]!.item.tipo === 'agendamento';
    const textoPt = linhas.map((l) => resumo({ tipo: l.item.tipo, quantidade: l.quantidade, agendadoPara: l.agendadoPara }, l.item.nome, fuso, 'pt')).join(', ');
    const valor = soma === null ? '' : ` · total ${brl(soma)}`;
    await this.acoes.notaInterna(
      c,
      s.id,
      `${reserva ? 'Reserva' : 'Pedido'} pelo ${base.origem}: ${notas.join('; ')}${valor}. Confirme ou recuse no cartão do pedido.`,
      { tipo: 'sistema' },
    );
    s = await this.acoes.colocarNaFila(c, s, linhas[0]!.item.setor_id, {
      ator: { tipo: 'solicitante', id: base.solicitanteId },
      motivo: 'pedido_catalogo',
      resumo: `${reserva ? 'Reserva' : 'Pedido'}: ${textoPt}${valor}`,
    });
    if (avisar) {
      // Aviso ao hóspede no idioma dele (fora de PT/ES/EN, sai em português e a saída traduz).
      const id = idiomaDoOriginal(s.idioma);
      const oQue = linhas.map((l) => resumo({ tipo: l.item.tipo, quantidade: l.quantidade, agendadoPara: l.agendadoPara }, nomeNo(l.item, id), fuso, id)).join(', ');
      const totalTxt = soma === null ? '' : { pt: ` Total: ${brl(soma)}, na conta do quarto.`, es: ` Total: ${brl(soma)}, en la cuenta de la habitación.`, en: ` Total: ${brl(soma)}, charged to your room.` }[id];
      const recebido = !reserva
        ? { pt: `Recebemos seu pedido: ${oQue}.${totalTxt} Avisamos aqui assim que for confirmado.`, es: `Recibimos su pedido: ${oQue}.${totalTxt} Le avisamos aquí apenas se confirme.`, en: `We got your order: ${oQue}.${totalTxt} We will let you know here as soon as it is confirmed.` }
        : { pt: `Recebemos sua reserva: ${oQue}.${totalTxt} Avisamos aqui assim que for confirmada.`, es: `Recibimos su reserva: ${oQue}.${totalTxt} Le avisamos aquí apenas se confirme.`, en: `We got your booking: ${oQue}.${totalTxt} We will let you know here as soon as it is confirmed.` };
      await this.acoes.enviarConteudo(c, s, { tipo: 'livre', texto: recebido });
    }
    return { s, pedidos, total: soma };
  }

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
        const fuso = await this.fuso(c, p.unidadeId);
        const linha = await this.prepararLinha(c, p.unidadeId, fuso, p.req);
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
              -- Pedido fechado conversando, ainda sem ninguém da equipe: a conversa segue com a IA.
              AND NOT (coalesce(s.contexto->>'doCarrinho', '') = 'true' AND s.estado IN ('na_fila', 'oferecida'))
            ORDER BY s.criado_em DESC LIMIT 1`,
          [solicitanteId, p.unidadeId, p.naoAntesDe],
        );
        const atual = ult.rows[0];
        const aberta = atual && ['automacao', 'na_fila', 'oferecida', 'em_atendimento', 'aguardando_solicitante'].includes(atual.estado) ? atual : null;
        const v = await c.tx.client.query<{ confirmado: boolean }>(
          `SELECT confirmado FROM vinculo WHERE solicitante_id = $1 AND unidade_id = $2 AND local_id = $3 AND fim > now()
            ORDER BY confirmado DESC, inicio DESC LIMIT 1`,
          [solicitanteId, p.unidadeId, p.localId],
        );
        const { id: versaoId } = await this.unidades.versaoAtual(c.tx, p.unidadeId);
        const r = await this.abrirAtendimento(
          c,
          {
            unidadeId: p.unidadeId,
            solicitanteId,
            canalId: p.canalId,
            versaoId,
            localId: p.localId,
            identificado: v.rows[0]?.confirmado ?? false,
            idioma: atual && (atual.contexto as { idiomaDefinido?: boolean }).idiomaDefinido ? atual.idioma : null,
            paralelaDe: aberta?.id ?? null,
            origem: 'chat do quarto',
          },
          [linha],
          fuso,
          true,
        );
        return r.pedidos[0]!;
      },
      { trava: `conversa:${p.canalId}:${telefone}` },
    );
  }

  /**
   * O carrinho montado conversando: itens do mesmo setor viram um atendimento só; cada
   * agendamento, o seu. Corre dentro da transação da conversa (o orquestrador já trava).
   * O hóspede é avisado pela própria conversa (quem chama), não por cada atendimento.
   */
  async criarDoCarrinho(
    c: Ctx,
    conversa: SolicitacaoRow,
    linhas: { itemId: string; quantidade: number; data?: string | null; hora?: string | null; observacao?: string | null }[],
  ): Promise<{ pedidos: PedidoView[]; total: number | null; atendimentos: number }> {
    if (!conversa.local_id) throw new BadRequestException('sem quarto: o pedido vai para a conta do quarto');
    const fuso = await this.fuso(c, conversa.unidade_id);
    const prontas: LinhaPronta[] = [];
    for (const l of linhas) prontas.push(await this.prepararLinha(c, conversa.unidade_id, fuso, l));
    const { id: versaoId } = await this.unidades.versaoAtual(c.tx, conversa.unidade_id);
    const base: BaseAtendimento = {
      unidadeId: conversa.unidade_id,
      solicitanteId: conversa.solicitante_id!,
      canalId: conversa.canal_id,
      versaoId,
      localId: conversa.local_id,
      identificado: conversa.identificado,
      idioma: (conversa.contexto as { idiomaDefinido?: boolean }).idiomaDefinido ? conversa.idioma : null,
      paralelaDe: null,
      origem: 'chat',
      doCarrinho: true,
    };
    const grupos = new Map<string, LinhaPronta[]>();
    for (const l of prontas) {
      const chave = l.item.tipo === 'agendamento' ? `ag:${grupos.size}:${l.item.id}` : `setor:${l.item.setor_id}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
    }
    const pedidos: PedidoView[] = [];
    let total: number | null = null;
    for (const g of grupos.values()) {
      const r = await this.abrirAtendimento(c, base, g, fuso, false);
      pedidos.push(...r.pedidos);
      if (r.total !== null) total = (total ?? 0) + r.total;
    }
    return { pedidos, total, atendimentos: grupos.size };
  }

  /**
   * "Minha conta": o que o quarto pediu pelo Ramais nesta estadia e as noites a mais, com a
   * situação de cada um (pago por link, link em aberto ou na conta do quarto). Diárias e o resto
   * do consumo ficam no sistema do hotel.
   */
  async contaDoQuarto(c: Ctx, localId: string, desde: Date): Promise<ContaHospedeView> {
    const ped = await c.tx.client.query<PedidoRow>(
      `${SELECT_PEDIDO} WHERE p.local_id = $1 AND p.criado_em >= $2 AND p.estado NOT IN ('recusado', 'cancelado') AND coalesce(p.total_centavos, 0) > 0
        ORDER BY p.criado_em`,
      [localId, desde],
    );
    const situacao = (estado: string | null | undefined): ContaHospedeView['itens'][number]['situacao'] =>
      estado === 'paga' ? 'pago' : estado === 'aguardando' ? 'aguardando' : 'na_conta';
    const itens: ContaHospedeView['itens'] = ped.rows.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      nome: p.item_nome,
      quantidade: p.quantidade,
      agendadoPara: p.agendado_para ? new Date(p.agendado_para).toISOString() : null,
      criadoEm: new Date(p.criado_em).toISOString(),
      valorCentavos: p.total_centavos!,
      situacao: situacao(p.cob_estado),
      link: p.cob_estado === 'aguardando' ? (p.cob_link ?? null) : null,
      de: null,
      ate: null,
    }));
    // Noites a mais: pagas por link (ou com link em aberto) ou confirmadas na conta do quarto.
    const ext = await c.tx.client.query<{ id: string; criado_em: Date; total: string; extensao: { cotacao?: { extension?: { check_in: string; check_out: string; nights: number } } }; cob_estado: string | null; cob_link: string | null; cob_valor: number | null; estado: string }>(
      `SELECT r.id, r.criado_em, r.total, r.extensao, r.estado, cb.estado AS cob_estado, cb.link AS cob_link, cb.valor_centavos AS cob_valor
         FROM reserva_hospedagem r JOIN solicitacao s ON s.id = r.solicitacao_id LEFT JOIN cobranca cb ON cb.id = r.cobranca_id
        WHERE r.tipo = 'extensao' AND s.local_id = $1 AND r.criado_em >= $2
          AND (cb.estado IN ('aguardando', 'paga') OR (r.cobranca_id IS NULL AND r.estado = 'paga'))
        ORDER BY r.criado_em`,
      [localId, desde],
    );
    for (const x of ext.rows) {
      const e = x.extensao?.cotacao?.extension;
      itens.push({
        id: x.id,
        tipo: 'estadia',
        nome: '',
        quantidade: e?.nights ?? 1,
        agendadoPara: null,
        criadoEm: new Date(x.criado_em).toISOString(),
        valorCentavos: x.cob_valor ?? Math.round(Number(x.total ?? 0) * 100),
        situacao: x.cob_estado ? situacao(x.cob_estado) : 'na_conta',
        link: x.cob_estado === 'aguardando' ? x.cob_link : null,
        de: e?.check_in ?? null,
        ate: e?.check_out ?? null,
      });
    }
    itens.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    const soma = (f: (i: ContaHospedeView['itens'][number]) => boolean) => itens.filter(f).reduce((t, i) => t + i.valorCentavos, 0);
    return {
      itens,
      pagoCentavos: soma((i) => i.situacao === 'pago'),
      abertoCentavos: soma((i) => i.situacao !== 'pago'),
      aPagarCentavos: this.cobrancas.disponivel ? soma((i) => i.situacao === 'na_conta' && i.tipo !== 'estadia') : 0,
      pagamentoOnline: this.cobrancas.disponivel,
    };
  }

  /**
   * "Pagar agora" na Minha conta: um link (Pix ou cartão) com tudo o que está na conta do quarto e
   * ainda não tem link. O link vai também para a conversa, e o pago avisa os setores.
   */
  async pagarConta(p: { orgId: string; unidadeId: string; localId: string; canalId: string; naoAntesDe: string }): Promise<{ link: string | null; valorCentavos: number }> {
    if (!this.cobrancas.disponivel) throw new ConflictException('pagamento online desligado neste hotel');
    const telefone = `quarto:${p.localId}`;
    return this.nucleo.executar(
      p.orgId,
      async (c) => {
        const conta = await this.contaDoQuarto(c, p.localId, new Date(p.naoAntesDe));
        const ids = conta.itens.filter((i) => i.situacao === 'na_conta' && i.tipo !== 'estadia').map((i) => i.id);
        if (!ids.length) throw new ConflictException('não há nada em aberto para pagar agora');
        // A conversa atual do quarto recebe o link e o aviso de pago.
        const ult = await c.tx.client.query<SolicitacaoRow>(
          `SELECT s.* FROM solicitacao s JOIN solicitante st ON st.id = s.solicitante_id
            WHERE st.telefone = $1 AND s.unidade_id = $2 AND s.origem = 'externa' AND s.criado_em >= $3
            ORDER BY s.criado_em DESC LIMIT 1`,
          [telefone, p.unidadeId, p.naoAntesDe],
        );
        const s = ult.rows[0];
        if (!s) throw new ConflictException('não há nada em aberto para pagar agora');
        const quarto = (await c.tx.client.query<{ identificador: string }>('SELECT identificador FROM local WHERE id = $1', [p.localId])).rows[0]?.identificador;
        const cob = await this.cobrar(c, s, ids, null, `conta do quarto${quarto ? ` ${quarto}` : ''} (${ids.length} ${ids.length === 1 ? 'item' : 'itens'})`);
        await this.acoes.enviarAoSolicitante(c, s, {
          texto: `Sua conta: ${brl(cob.valor_centavos)}.\n${await this.cobrancas.textoDoLink(c, cob)}\nAssim que o pagamento cair, aviso aqui.`,
          idioma: 'pt',
          autor: { tipo: 'ia' },
        });
        await this.acoes.notaInterna(c, s.id, `O hóspede pediu para pagar a conta por link (Minha conta): ${brl(cob.valor_centavos)}, ${ids.length} ${ids.length === 1 ? 'item' : 'itens'}.`, { tipo: 'sistema' });
        return { link: cob.link, valorCentavos: cob.valor_centavos };
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
    await this.acoes.notaInterna(c, s.id, `O hóspede cancelou pelo chat: ${p.item_nome}.`, { tipo: 'sistema' });
    await this.acoes.enviarConteudo(c, s, {
      tipo: 'livre',
      texto: { pt: `Pedido cancelado: ${p.item_nome}.`, es: `Pedido cancelado: ${p.item_nome}.`, en: `Order cancelled: ${p.item_nome}.` },
    });
    const resta = await c.tx.client.query(`SELECT 1 FROM pedido WHERE solicitacao_id = $1 AND estado IN ('pendente', 'confirmado')`, [s.id]);
    if (!resta.rowCount) await this.acoes.encerrar(c, await this.acoes.carregar(c, s.id), { tipo: 'solicitante', id: s.solicitante_id }, 'pedido cancelado');
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

  async porSolicitacao(c: Ctx, solicitacaoId: string, pessoaId: string): Promise<PedidoView[]> {
    const s = await this.acoes.carregar(c, solicitacaoId, false);
    await this.comandos.exigirAcesso(c, s, pessoaId);
    const r = await c.tx.client.query<PedidoRow>(`${SELECT_PEDIDO} WHERE p.solicitacao_id = $1 ORDER BY p.criado_em, p.id`, [solicitacaoId]);
    return r.rows.map(pedidoView);
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

  /** O atendimento do pedido e todos os itens dele (a equipe responde pelo grupo). */
  private async contexto(c: Ctx, pedidoId: string, pessoaId: string) {
    const p = await this.carregar(c, pedidoId);
    const s = await this.acoes.carregar(c, p.solicitacao_id);
    await this.comandos.exigirAcesso(c, s, pessoaId);
    const todos = (await c.tx.client.query<PedidoRow>('SELECT * FROM pedido WHERE solicitacao_id = $1 ORDER BY criado_em, id FOR UPDATE', [s.id])).rows;
    const fuso = await this.fuso(c, p.unidade_id);
    const texto = (lista: PedidoRow[]) =>
      lista.map((x) => resumo({ tipo: x.tipo, quantidade: x.quantidade, agendadoPara: x.agendado_para ? new Date(x.agendado_para) : null }, x.item_nome, fuso, 'pt')).join(', ');
    return { p, s, todos, texto };
  }

  /** Mensagem da equipe ao hóspede: escrita em português, sai traduzida para o idioma dele. */
  private falar(c: Ctx, s: SolicitacaoRow, texto: string, pessoaId: string) {
    return this.acoes.enviarAoSolicitante(c, s, { texto, idioma: 'pt', autor: { tipo: 'pessoa', id: pessoaId } });
  }

  async confirmar(orgId: string, pedidoId: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { s: s0, todos, texto } = await this.contexto(c, pedidoId, pessoaId);
      const alvo = todos.filter((x) => x.estado === 'pendente');
      if (!alvo.length) throw new ConflictException('este pedido já foi respondido');
      const s = await this.assumir(c, s0, pessoaId);
      for (const x of alvo) await this.mudar(c, x, 'confirmado', pessoaId, null);
      await this.acoes.notaInterna(c, s.id, alvo.length > 1 ? `Pedido confirmado (${alvo.length} itens).` : 'Pedido confirmado.', { tipo: 'pessoa', id: pessoaId });
      const agendamento = alvo[0]!.tipo === 'agendamento';
      await this.falar(c, s, agendamento ? `Reserva confirmada: ${texto(alvo)}. Até lá!` : `Pedido confirmado: ${texto(alvo)}. Já estamos cuidando disso.`, pessoaId);
      return { ok: true };
    });
  }

  async recusar(orgId: string, pedidoId: string, pessoaId: string, motivo: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { s: s0, todos, texto } = await this.contexto(c, pedidoId, pessoaId);
      const alvo = todos.filter((x) => x.estado === 'pendente' || x.estado === 'confirmado');
      if (!alvo.length) throw new ConflictException('este pedido já foi encerrado');
      const s = await this.assumir(c, s0, pessoaId);
      for (const x of alvo) await this.mudar(c, x, 'recusado', pessoaId, motivo);
      await this.acoes.notaInterna(c, s.id, `Pedido recusado: ${motivo}`, { tipo: 'pessoa', id: pessoaId });
      await this.falar(c, s, `Não conseguimos atender: ${texto(alvo)}. ${motivo}. Se quiser, escolha outra opção no Menu principal.`, pessoaId);
      await this.acoes.encerrar(c, await this.acoes.carregar(c, s.id), { tipo: 'pessoa', id: pessoaId }, 'pedido recusado');
      return { ok: true };
    });
  }

  /** Marcar como lançado na conta do quarto (o PMS ainda é à mão). */
  async lancar(orgId: string, pedidoId: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { s, todos } = await this.contexto(c, pedidoId, pessoaId);
      // O que já foi pago por link não vai para a conta.
      const pagos = new Set(
        (await c.tx.client.query<{ id: string }>(`SELECT p.id FROM pedido p JOIN cobranca cb ON cb.id = p.cobranca_id WHERE p.solicitacao_id = $1 AND cb.estado = 'paga'`, [s.id])).rows.map((x) => x.id),
      );
      const alvo = todos.filter((x) => !x.lancado_em && x.estado !== 'recusado' && x.estado !== 'cancelado' && !pagos.has(x.id));
      if (!alvo.length) {
        if (todos.some((x) => x.lancado_em)) return { ok: true };
        if (pagos.size) throw new ConflictException('já foi pago por link: não vai para a conta do quarto');
        throw new ConflictException('pedido recusado ou cancelado não vai para a conta');
      }
      await c.tx.client.query('UPDATE pedido SET lancado_em = now(), atualizado_em = now() WHERE id = ANY($1::uuid[])', [alvo.map((x) => x.id)]);
      const soma = alvo.reduce<number | null>((t, x) => (x.total_centavos === null ? t : (t ?? 0) + x.total_centavos), null);
      await this.acoes.notaInterna(c, s.id, `Lançado na conta do quarto${soma !== null ? `: ${brl(soma)}` : ''}.`, { tipo: 'pessoa', id: pessoaId });
      this.acoes.avisarAtualizacao(c, s);
      return { ok: true };
    });
  }

  /** Entregue (compra) ou realizado (agendamento): conclui os itens e resolve o atendimento. */
  async concluir(orgId: string, pedidoId: string, pessoaId: string) {
    return this.nucleo.executar(orgId, async (c) => {
      const { s: s0, todos } = await this.contexto(c, pedidoId, pessoaId);
      const alvo = todos.filter((x) => x.estado === 'pendente' || x.estado === 'confirmado');
      if (!alvo.length) throw new ConflictException('este pedido já foi encerrado');
      const s = await this.assumir(c, s0, pessoaId);
      for (const x of alvo) await this.mudar(c, x, 'concluido', pessoaId, null);
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
