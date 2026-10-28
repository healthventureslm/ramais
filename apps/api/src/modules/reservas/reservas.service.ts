import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ContextoReserva, ExtracaoReserva, ServicosIA } from '@ramais/ai';
import { dataLocal, diaDaSemana } from '@ramais/domain';
import type { Config } from '../../config.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { CONFIG, IA } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';
import { ClienteVoa, ErroVoa, type QuartoBusca, type TarifaVoa } from '../../infra/voa.js';
import { Acoes } from '../solicitacoes/acoes.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';

/** O que se sabe do pedido de hospedagem até agora. */
export interface PedidoReserva {
  checkIn?: string | null;
  checkOut?: string | null;
  noites?: number | null;
  quartos?: number | null;
  adultos?: number | null;
  criancas?: number | null;
  idadesCriancas?: number[];
  estender?: boolean;
}

interface OpcaoMostrada extends TarifaVoa {
  n: number;
}

export interface ReservaRow {
  id: string;
  unidade_id: string;
  solicitacao_id: string;
  voa_hotel_id: number;
  estado: string;
  pedido: PedidoReserva;
  busca: { id: string; expira: string | null; opcoes: OpcaoMostrada[]; checkIn: string; checkOut: string; quartos: QuartoBusca[] } | null;
  escolha: OpcaoMostrada | null;
  titular_nome: string | null;
  titular_email: string | null;
  oferta_uuid: string | null;
  link: string | null;
  total: string | null;
  expira_em: Date | null;
  booking_id: string | null;
  ultima_pergunta: string | null;
}

/** Aviso de pagamento da VOA (webhook). */
export interface EventoVoa {
  event?: string;
  checkout_id?: number;
  checkout_uuid?: string;
  hotel_id?: number;
  status?: string;
  booking_status?: string;
  booking_id?: string | null;
  total?: number;
  payment_method?: string;
  paid_at?: string | null;
}

const ATIVOS = ['coletando', 'opcoes', 'titular'];
const VAZIA: ExtracaoReserva = {
  querReservar: false,
  sobreReserva: false,
  desiste: false,
  estender: false,
  checkIn: null,
  checkOut: null,
  noites: null,
  quartos: null,
  adultos: null,
  criancas: null,
  idadesCriancas: [],
  escolha: null,
  nome: null,
  email: null,
  modelo: 'nenhum',
};
const DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_OPCOES = 6;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const somarDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a!, m! - 1, d! + n)).toISOString().slice(0, 10);
};
const noitesEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function pessoasTexto(p: PedidoReserva): string {
  const ad = p.adultos ?? 0;
  const cr = p.idadesCriancas?.length ?? p.criancas ?? 0;
  const partes = [`${ad} ${ad === 1 ? 'adulto' : 'adultos'}`];
  if (cr) partes.push(`${cr} ${cr === 1 ? 'criança' : 'crianças'}`);
  if ((p.quartos ?? 1) > 1) partes.push(`${p.quartos} quartos`);
  return partes.join(', ');
}

/** Divide as pessoas pelos quartos: adultos o mais igual possível, crianças a partir do primeiro. */
function ocupacao(p: PedidoReserva): QuartoBusca[] {
  const n = Math.max(1, p.quartos ?? 1);
  const ad = Math.max(n, p.adultos ?? 1);
  const quartos: QuartoBusca[] = Array.from({ length: n }, (_, i) => ({ adultos: Math.floor(ad / n) + (i < ad % n ? 1 : 0), idadesCriancas: [] }));
  (p.idadesCriancas ?? []).forEach((idade, i) => quartos[i % n]!.idadesCriancas.push(idade));
  return quartos;
}

function descreverOpcao(o: TarifaVoa): string {
  const cancel = o.cancelavel
    ? o.cancelamentoAte
      ? `cancelamento grátis até ${dm(o.cancelamentoAte)}`
      : 'com cancelamento'
    : 'não reembolsável';
  return `${o.quartoNome}, ${o.regimeNome.toLowerCase()}: ${brl(o.total)} (${cancel})`;
}

/**
 * Reserva de hospedagem pela conversa, automática do começo ao fim: a IA pergunta o que falta,
 * busca na VOA, mostra as opções, gera o link de pagamento e avisa quando o webhook confirma.
 * A equipe acompanha pelas notas e só entra se o hóspede pedir uma pessoa ou se a VOA falhar.
 */
@Injectable()
export class Reservas {
  private readonly log = new Logger('reservas');

  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
    private readonly voa: ClienteVoa,
    @Inject(IA) private readonly ia: ServicosIA,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  /** A integração vale para esta unidade? (token da VOA e o hotel cadastrado). */
  async hotelDaUnidade(c: Ctx, unidadeId: string): Promise<number | null> {
    if (!this.voa.disponivel || !this.ia.reserva.disponivel) return null;
    const r = await c.tx.client.query<{ voa_hotel_id: number | null }>('SELECT voa_hotel_id FROM unidade WHERE id = $1', [unidadeId]);
    return r.rows[0]?.voa_hotel_id ?? null;
  }

  /** Para a análise (sem travar): a unidade tem reserva automática? há uma em andamento nesta conversa? */
  async paraAnalise(c: Ctx, s: SolicitacaoRow): Promise<{ hotel: number | null; ativa: ReservaRow | null }> {
    const hotel = await this.hotelDaUnidade(c, s.unidade_id);
    if (!hotel) return { hotel: null, ativa: null };
    const r = await c.tx.client.query<ReservaRow>(
      `SELECT * FROM reserva_hospedagem WHERE solicitacao_id = $1 AND estado = ANY($2::text[]) ORDER BY criado_em DESC LIMIT 1`,
      [s.id, ATIVOS],
    );
    return { hotel, ativa: r.rows[0] ?? null };
  }

  async ativa(c: Ctx, solicitacaoId: string): Promise<ReservaRow | null> {
    const r = await c.tx.client.query<ReservaRow>(
      `SELECT * FROM reserva_hospedagem WHERE solicitacao_id = $1 AND estado = ANY($2::text[]) ORDER BY criado_em DESC LIMIT 1 FOR UPDATE`,
      [solicitacaoId, ATIVOS],
    );
    return r.rows[0] ?? null;
  }

  /** O que a IA precisa saber para ler a próxima mensagem (hoje no hotel, o já sabido, as opções). */
  contexto(fuso: string, r: ReservaRow | null): ContextoReserva {
    const hoje = dataLocal(new Date(), fuso);
    return {
      hoje,
      diaSemana: DIAS[diaDaSemana(hoje)]!,
      conhecido: r ? { ...r.pedido } : null,
      opcoes: r?.estado === 'opcoes' ? (r.busca?.opcoes ?? []).map(descreverOpcao) : undefined,
      pergunta: r?.ultima_pergunta ?? null,
    };
  }

  /** A mensagem é sobre reservar hospedagem? Na dúvida a IA diz (o filtro barato vem antes). */
  async extrair(texto: string, ctx: ContextoReserva): Promise<ExtracaoReserva | null> {
    try {
      return await this.ia.reserva.extrair(texto, ctx);
    } catch (e) {
      this.log.warn(`extração de reserva falhou: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Trata a mensagem dentro do fluxo de reserva. Devolve true se cuidou dela (nada mais a fazer),
   * false se a mensagem não é da reserva e segue o caminho normal.
   */
  async tratar(
    c: Ctx,
    s: SolicitacaoRow,
    ex: ExtracaoReserva | null,
    kb: { responde: boolean; resposta: string | null; confianca: number } | null,
    limiteKb: number,
    texto = '',
  ): Promise<boolean> {
    let r = await this.ativa(c, s.id);
    // Respostas óbvias valem sem depender da IA: o número da opção, o nome do titular.
    if (r) {
      const direta = this.respostaDireta(r, ex ?? VAZIA, texto);
      if (ex || direta.sobreReserva) ex = direta;
    }
    if (!r) {
      if (!ex?.querReservar) return false;
      const hotel = await this.hotelDaUnidade(c, s.unidade_id);
      if (!hotel) return false;
      const ins = await c.tx.client.query<ReservaRow>(
        `INSERT INTO reserva_hospedagem (org_id, unidade_id, solicitacao_id, voa_hotel_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [c.tx.orgId, s.unidade_id, s.id, hotel],
      );
      r = ins.rows[0]!;
      await this.acoes.notaInterna(c, s.id, 'Reserva de hospedagem automática: a IA está atendendo (busca na VOA e link de pagamento).', { tipo: 'sistema' });
      await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'reserva_iniciada', atorTipo: 'ia', dados: { reserva: r.id } });
    } else if (!ex) {
      // A IA não leu a mensagem: repete a pergunta em vez de perder o fio.
      if (r.ultima_pergunta) await this.falar(c, s, r.ultima_pergunta);
      return true;
    } else if (ex.desiste) {
      await this.mudar(c, r, { estado: 'desistiu' });
      await this.falar(c, s, 'Tudo bem, deixei a reserva de lado. Se mudar de ideia, é só me chamar.');
      await this.concluir(c, s, 'Reserva: o hóspede desistiu.');
      return true;
    } else if (!ex.sobreReserva && !ex.querReservar) {
      // Outro assunto no meio da reserva: a base responde e a pergunta da reserva volta.
      if (kb?.responde && kb.resposta && kb.confianca >= limiteKb) {
        await this.acoes.enviarAoSolicitante(c, s, { texto: kb.resposta, idioma: 'pt', autor: { tipo: 'ia' } });
        if (r.ultima_pergunta) await this.falar(c, s, r.ultima_pergunta);
        return true;
      }
      // Sem resposta: a reserva fica parada e a mensagem segue para a equipe.
      await this.mudar(c, r, { estado: 'desistiu' });
      await this.acoes.notaInterna(c, s.id, 'Reserva automática interrompida: o hóspede mudou de assunto.', { tipo: 'sistema' });
      return false;
    }

    // Junta o que a mensagem trouxe ao que já se sabia.
    const p: PedidoReserva = { ...r.pedido };
    if (ex) {
      if (ex.estender) p.estender = true;
      if (ex.checkIn) p.checkIn = ex.checkIn;
      if (ex.checkOut) p.checkOut = ex.checkOut;
      if (ex.noites) p.noites = ex.noites;
      if (ex.quartos) p.quartos = ex.quartos;
      if (ex.adultos) p.adultos = ex.adultos;
      if (ex.criancas !== null) p.criancas = ex.criancas;
      if (ex.idadesCriancas.length) p.idadesCriancas = ex.idadesCriancas;
    }
    // Estender a estadia: a entrada é o check-out atual (lista de hóspedes do quarto).
    if (p.estender && !p.checkIn && s.local_id) {
      const h = await c.tx.client.query<{ checkout: string }>(
        `SELECT checkout::text FROM hospede_ativo WHERE local_id = $1 AND current_date BETWEEN checkin AND checkout ORDER BY checkout DESC LIMIT 1`,
        [s.local_id],
      );
      if (h.rows[0]) p.checkIn = h.rows[0].checkout;
    }
    if (p.checkIn && p.noites && (!p.checkOut || p.checkOut <= p.checkIn)) p.checkOut = somarDias(p.checkIn, p.noites);
    if (p.checkIn && p.checkOut && p.checkOut <= p.checkIn) p.checkOut = null;
    const mudouPedido = JSON.stringify(p) !== JSON.stringify(r.pedido);
    r = await this.mudar(c, r, { pedido: p });

    // Nome e e-mail do titular (o hóspede pode mandar junto com a escolha).
    if (ex?.nome) r = await this.mudar(c, r, { titular_nome: ex.nome });
    if (ex?.email) r = await this.mudar(c, r, { titular_email: ex.email });

    // Escolha de uma opção.
    if (r.estado === 'opcoes' && !mudouPedido) {
      const n = ex?.escolha;
      const opcao = n ? r.busca?.opcoes.find((o) => o.n === n) : null;
      if (!opcao) {
        await this.perguntar(c, s, r, `Qual das opções você prefere? Responda com o número (de 1 a ${r.busca?.opcoes.length ?? 1}).`);
        return true;
      }
      r = await this.mudar(c, r, { escolha: opcao, estado: 'titular' });
    }

    if (r.estado === 'titular' && !mudouPedido) {
      if (!r.titular_nome) {
        const nome = await this.nomeConhecido(c, s);
        if (nome) r = await this.mudar(c, r, { titular_nome: nome });
      }
      if (!r.titular_nome) {
        await this.perguntar(
          c,
          s,
          r,
          'Ótima escolha! Para emitir o link de pagamento, qual o nome completo do titular da reserva? Se quiser receber a confirmação por e-mail, mande o e-mail também.',
        );
        return true;
      }
      await this.gerarLink(c, s, r);
      return true;
    }

    // Faltam dados: pergunta só o que falta.
    if (!p.checkIn) {
      await this.perguntar(c, s, r, 'Claro! Para quais datas? Me diga o dia de entrada e o de saída (por exemplo: de 20 a 22 de novembro).');
      return true;
    }
    if (!p.checkOut) {
      await this.perguntar(c, s, r, `Entrada em ${dm(p.checkIn)}. E qual seria o dia de saída?`);
      return true;
    }
    if (noitesEntre(p.checkIn, p.checkOut) > 30) {
      r = await this.mudar(c, r, { pedido: { ...p, checkOut: null, noites: null } });
      await this.perguntar(c, s, r, 'Por aqui consigo reservar até 30 noites. Qual seria o dia de saída?');
      return true;
    }
    if (!p.adultos) {
      await this.perguntar(c, s, r, 'Quantos adultos e quantas crianças? Se houver crianças, diga a idade de cada uma.');
      return true;
    }
    if ((p.criancas ?? 0) > (p.idadesCriancas?.length ?? 0)) {
      await this.perguntar(c, s, r, 'Qual a idade de cada criança? A idade muda o preço e o tipo de quarto.');
      return true;
    }

    await this.buscar(c, s, r, p);
    return true;
  }

  private async buscar(c: Ctx, s: SolicitacaoRow, r: ReservaRow, p: PedidoReserva) {
    const quartos = ocupacao(p);
    let busca;
    try {
      busca = await this.voa.buscar(r.voa_hotel_id, p.checkIn!, p.checkOut!, quartos);
    } catch (e) {
      await this.falhou(c, s, r, e);
      return;
    }
    const periodo = `de ${dm(p.checkIn!)} a ${dm(p.checkOut!)}`;
    if (!busca.ok || !busca.id) {
      r = await this.mudar(c, r, { estado: 'coletando', pedido: { ...p, checkIn: null, checkOut: null, noites: null } });
      await this.acoes.notaInterna(c, s.id, `Reserva: sem disponibilidade ${periodo} para ${pessoasTexto(p)}${busca.motivo ? ` (${busca.motivo})` : ''}.`, { tipo: 'sistema' });
      await this.perguntar(
        c,
        s,
        r,
        `Não encontrei disponibilidade ${periodo} para ${pessoasTexto(p)}${busca.motivo ? `: ${busca.motivo}` : ''}. Quer tentar outras datas?`,
      );
      return;
    }
    const opcoes: OpcaoMostrada[] = busca.tarifas.slice(0, MAX_OPCOES).map((t, i) => ({ ...t, n: i + 1 }));
    const noites = opcoes[0]!.noites;
    r = await this.mudar(c, r, {
      estado: 'opcoes',
      busca: { id: busca.id, expira: busca.expira, opcoes, checkIn: p.checkIn!, checkOut: p.checkOut!, quartos },
      escolha: null,
    });
    await this.acoes.atualizar(c, s, { resumo: `Reserva de hospedagem ${periodo} (${noites} ${noites === 1 ? 'noite' : 'noites'}), ${pessoasTexto(p)}` });
    await this.acoes.notaInterna(c, s.id, `Reserva: ${opcoes.length} opções mostradas ${periodo} para ${pessoasTexto(p)}.`, { tipo: 'sistema' });
    const lista = opcoes.map((o) => `${o.n}. ${descreverOpcao(o)}`).join('\n');
    await this.perguntar(
      c,
      s,
      r,
      `Encontrei estas opções ${periodo} (${noites} ${noites === 1 ? 'noite' : 'noites'}) para ${pessoasTexto(p)}. Os valores são o total da estadia, com impostos:\n${lista}\n\nResponda com o número da opção que você prefere.`,
    );
  }

  private async gerarLink(c: Ctx, s: SolicitacaoRow, r: ReservaRow) {
    const b = r.busca!;
    let escolha = r.escolha!;
    let buscaId = b.id;
    // A busca vale 30 min: vencida, busca de novo e procura o mesmo quarto e tarifa.
    if (!b.expira || Date.parse(b.expira) < Date.now() + 60_000) {
      try {
        const nova = await this.voa.buscar(r.voa_hotel_id, b.checkIn, b.checkOut, b.quartos);
        const mesma = nova.tarifas.find((t) => t.quartoId === escolha.quartoId && t.tarifaId === escolha.tarifaId);
        if (!nova.ok || !nova.id || !mesma) {
          r = await this.mudar(c, r, { estado: 'coletando' });
          await this.buscar(c, s, r, r.pedido);
          return;
        }
        buscaId = nova.id;
        escolha = { ...mesma, n: escolha.n };
      } catch (e) {
        await this.falhou(c, s, r, e);
        return;
      }
    }
    const sol = await c.tx.client.query<{ telefone: string }>('SELECT telefone FROM solicitante WHERE id = $1', [s.solicitante_id]);
    const tel = sol.rows[0]?.telefone;
    const expiraEm = new Date(Date.now() + this.cfg.VOA_LINK_MINUTOS * 60_000);
    let oferta;
    try {
      oferta = await this.voa.criarOferta({
        hotelId: r.voa_hotel_id,
        buscaId,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        quartos: b.quartos,
        quartoId: escolha.quartoId,
        tarifaId: escolha.tarifaId,
        nome: r.titular_nome,
        email: r.titular_email,
        telefone: tel && !tel.startsWith('quarto:') ? `+${tel.replace(/\D/g, '')}` : null,
        expiraEm,
        criadoPor: 'Ramais (atendimento automático)',
      });
    } catch (e) {
      // Esgotou entre a busca e a oferta: busca de novo e mostra o que sobrou.
      if (e instanceof ErroVoa && e.status === 406) {
        r = await this.mudar(c, r, { estado: 'coletando' });
        await this.falar(c, s, 'Essa opção acabou de esgotar. Vou buscar de novo o que está disponível.');
        await this.buscar(c, s, r, r.pedido);
        return;
      }
      await this.falhou(c, s, r, e);
      return;
    }
    r = await this.mudar(c, r, {
      estado: 'aguardando_pagamento',
      escolha,
      oferta_id: oferta.id,
      oferta_uuid: oferta.uuid,
      link: oferta.link,
      total: oferta.total,
      expira_em: new Date(oferta.expira),
      booking_id: oferta.bookingId,
      ultima_pergunta: null,
    });
    const fuso = (await this.unidades.versaoAtual(c.tx, s.unidade_id)).fuso;
    const ate = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(oferta.expira));
    const p = r.pedido;
    const resumo = `${escolha.quartoNome}, ${escolha.regimeNome.toLowerCase()}, de ${dm(b.checkIn)} a ${dm(b.checkOut)}, ${pessoasTexto(p)}`;
    await this.falar(
      c,
      s,
      `Pronto! ${resumo}. Total: ${brl(oferta.total)}.\nPague por este link até ${ate} (cartão de crédito, com parcelamento, ou Pix):\n${oferta.link}\nAssim que o pagamento for confirmado, eu aviso aqui.`,
    );
    await this.acoes.notaInterna(
      c,
      s.id,
      `Reserva: link de pagamento enviado. ${resumo}. Total ${brl(oferta.total)}. Titular: ${r.titular_nome ?? 'não informado'}${r.titular_email ? ` (${r.titular_email})` : ''}. Oferta ${oferta.uuid}.`,
      { tipo: 'sistema' },
    );
    await this.concluir(c, s, `Reserva: ${resumo} · ${brl(oferta.total)} · aguardando pagamento`);
  }

  /** Aviso de pagamento da VOA. Atualiza a reserva, avisa o hóspede e a equipe. */
  async aoPagamento(c: Ctx, reservaId: string, ev: EventoVoa): Promise<void> {
    const q = await c.tx.client.query<ReservaRow>('SELECT * FROM reserva_hospedagem WHERE id = $1 FOR UPDATE', [reservaId]);
    let r = q.rows[0];
    if (!r) return;
    const s = await this.acoes.carregar(c, r.solicitacao_id, false);
    const status = (ev.status ?? '').toUpperCase();
    const booking = (ev.booking_status ?? '').toUpperCase();
    const codigo = ev.booking_id ?? r.booking_id;
    const definitivo = Boolean(codigo && !/PRE-/i.test(codigo));
    const novoEstado =
      status === 'PAID'
        ? 'paga'
        : status === 'REFUSED' || status === 'DENIED'
          ? 'recusada'
          : status === 'EXPIRED'
            ? 'expirada'
            : status === 'REFUNDED'
              ? 'estornada'
              : status === 'CANCELLED' || booking === 'CANCELLED'
                ? 'cancelada'
                : r.estado;
    const jaConfirmada = r.estado === 'paga' && r.booking_id === codigo && definitivo;
    r = await this.mudar(c, r, {
      estado: novoEstado,
      status_pagamento: status || null,
      status_reserva: booking || null,
      booking_id: codigo,
      ...(status === 'PAID' ? { pago_em: ev.paid_at ? new Date(ev.paid_at) : new Date() } : {}),
    });
    const resumo = r.escolha ? `${r.escolha.quartoNome}, de ${dm(r.busca!.checkIn)} a ${dm(r.busca!.checkOut)}` : 'reserva';
    await this.nucleo.evento(c, { solicitacaoId: s.id, tipo: 'reserva_pagamento', atorTipo: 'sistema', dados: { status, booking, codigo } });

    if (status === 'PAID') {
      if (jaConfirmada) return;
      if (booking === 'CONFIRMED' && definitivo) {
        await this.falar(c, s, `Pagamento confirmado! Sua reserva está garantida: ${resumo}. Código da reserva: ${codigo}.${r.titular_email ? ' A confirmação também foi para o seu e-mail.' : ''}`);
        await this.acoes.notaInterna(c, s.id, `Reserva PAGA e confirmada no hotel: ${codigo} · ${resumo} · ${r.total ? brl(Number(r.total)) : ''}.`, { tipo: 'sistema' });
        await this.acoes.atualizar(c, s, { resumo: `Reserva paga: ${codigo} · ${resumo}` });
        await this.avisarRecepcao(c, s, `Reserva paga pelo Ramais: ${codigo}`, `${resumo} · ${r.titular_nome ?? ''}`);
      } else {
        await this.falar(c, s, 'Pagamento aprovado! Estamos finalizando a sua reserva no hotel e já te mando o código definitivo.');
        await this.acoes.notaInterna(c, s.id, `Reserva: pagamento aprovado, aguardando a confirmação do hotel (${codigo ?? 'sem código'}).`, { tipo: 'sistema' });
      }
      return;
    }
    if (status === 'REFUSED' || status === 'DENIED') {
      const ainda = r.expira_em && new Date(r.expira_em) > new Date();
      await this.falar(
        c,
        s,
        ainda && r.link
          ? `O pagamento não foi aprovado. Você pode tentar de novo pelo mesmo link: ${r.link}`
          : 'O pagamento não foi aprovado e o link expirou. Se ainda quiser a reserva, é só me dizer que eu busco de novo.',
      );
      await this.acoes.notaInterna(c, s.id, 'Reserva: pagamento recusado.', { tipo: 'sistema' });
      return;
    }
    if (status === 'EXPIRED') {
      await this.falar(c, s, 'O link de pagamento expirou. Se ainda quiser a reserva, é só me dizer que eu busco de novo.');
      await this.acoes.notaInterna(c, s.id, 'Reserva: o link de pagamento expirou sem pagamento.', { tipo: 'sistema' });
      return;
    }
    if (status === 'REFUNDED' || status === 'CANCELLED' || booking === 'CANCELLED') {
      await this.falar(c, s, `A ${status === 'REFUNDED' ? 'cobrança foi estornada' : 'reserva foi cancelada'}: ${resumo}${codigo ? ` (${codigo})` : ''}.`);
      await this.acoes.notaInterna(c, s.id, `Reserva ${status === 'REFUNDED' ? 'estornada' : 'cancelada'} (${codigo ?? ''}).`, { tipo: 'sistema' });
      await this.avisarRecepcao(c, s, `Reserva ${status === 'REFUNDED' ? 'estornada' : 'cancelada'}`, `${codigo ?? ''} · ${resumo}`);
    }
  }

  // ---------- auxiliares ----------

  /** "2" quando há opções é a escolha; um nome quando a pergunta é o titular é o nome. */
  private respostaDireta(r: ReservaRow, ex: ExtracaoReserva, texto: string): ExtracaoReserva {
    const t = texto.trim();
    if (r.estado === 'opcoes' && !ex.escolha) {
      const n = /^(?:op[cç][aã]o\s*)?(\d{1,2})[.!]?$/i.exec(t)?.[1];
      if (n) return { ...ex, escolha: Number(n), sobreReserva: true };
    }
    if (r.estado === 'titular') {
      const email = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}/.exec(t)?.[0] ?? null;
      const resto = t.replace(email ?? '', '').replace(/[,;]+/g, ' ').trim();
      const pareceNome = /^[\p{L}' .-]{3,80}$/u.test(resto) && resto.split(/\s+/).length >= 2 && resto.split(/\s+/).length <= 6;
      if (!ex.nome && pareceNome) ex = { ...ex, nome: resto };
      if (!ex.email && email) ex = { ...ex, email };
      if (ex.nome || ex.email) return { ...ex, sobreReserva: true };
    }
    return ex;
  }

  /** Nome que já conhecemos (perfil do WhatsApp); "Quarto 302" não serve. */
  private async nomeConhecido(c: Ctx, s: SolicitacaoRow): Promise<string | null> {
    const r = await c.tx.client.query<{ nome: string | null }>('SELECT nome FROM solicitante WHERE id = $1', [s.solicitante_id]);
    const nome = r.rows[0]?.nome?.trim();
    return nome && !/^quarto /i.test(nome) && nome.split(/\s+/).length >= 2 ? nome : null;
  }

  /** A IA fala com o hóspede em português; a saída traduz para o idioma dele. */
  private falar(c: Ctx, s: SolicitacaoRow, texto: string) {
    return this.acoes.enviarAoSolicitante(c, s, { texto, idioma: 'pt', autor: { tipo: 'ia' } });
  }

  private async perguntar(c: Ctx, s: SolicitacaoRow, r: ReservaRow, texto: string) {
    await this.mudar(c, r, { ultima_pergunta: texto });
    await this.falar(c, s, texto);
  }

  private async mudar(c: Ctx, r: ReservaRow, campos: Record<string, unknown>): Promise<ReservaRow> {
    const chaves = Object.keys(campos);
    if (!chaves.length) return r;
    const json = new Set(['pedido', 'busca', 'escolha']);
    const sets = chaves.map((k, i) => `${k} = $${i + 2}${json.has(k) ? '::jsonb' : ''}`);
    const vals = chaves.map((k) => (json.has(k) && campos[k] !== null ? JSON.stringify(campos[k]) : campos[k]));
    const q = await c.tx.client.query<ReservaRow>(
      `UPDATE reserva_hospedagem SET ${sets.join(', ')}, atualizado_em = now() WHERE id = $1 RETURNING *`,
      [r.id, ...vals],
    );
    return q.rows[0]!;
  }

  /** O atendimento automático terminou (link enviado ou desistência): resolve a solicitação. */
  private async concluir(c: Ctx, s: SolicitacaoRow, resumo: string) {
    const atual = await this.acoes.carregar(c, s.id);
    const com = await this.acoes.atualizar(c, atual, { resumo });
    if (com.estado === 'automacao') await this.acoes.resolver(c, com, { tipo: 'ia' });
  }

  /** A VOA falhou: o hóspede é avisado e a recepção assume. */
  private async falhou(c: Ctx, s: SolicitacaoRow, r: ReservaRow, e: unknown) {
    this.log.warn(`VOA falhou (reserva ${r.id}): ${(e as Error).message}`);
    await this.mudar(c, r, { estado: 'erro' });
    await this.acoes.notaInterna(c, s.id, `Reserva automática parou: a VOA respondeu com erro (${(e as Error).message.slice(0, 200)}). Pedido: ${pessoasTexto(r.pedido)}, ${r.pedido.checkIn ?? '?'} a ${r.pedido.checkOut ?? '?'}.`, { tipo: 'sistema' });
    await this.falar(c, s, 'Tive um problema para consultar a disponibilidade agora. Vou passar o seu pedido para a recepção, que te responde por aqui.');
    const recepcao = await this.unidades.setorPorChave(c.tx, s.unidade_id, 'recepcao');
    const atual = await this.acoes.carregar(c, s.id);
    if (recepcao && ['automacao', 'resolvida'].includes(atual.estado)) {
      await this.acoes.colocarNaFila(c, atual, recepcao.id, { ator: { tipo: 'ia' }, motivo: 'reserva_erro_voa', resumo: `Reserva de hospedagem: ${pessoasTexto(r.pedido)}` });
    }
  }

  /** Recepção no turno fica sabendo de reserva paga ou cancelada (push e aviso no painel). */
  private async avisarRecepcao(c: Ctx, s: SolicitacaoRow, titulo: string, corpo: string) {
    const r = await c.tx.client.query<{ pessoa_id: string }>(
      `SELECT DISTINCT l.pessoa_id FROM lotacao l JOIN setor st ON st.id = l.setor_id AND st.chave = 'recepcao' AND st.unidade_id = $1
         JOIN presenca p ON p.pessoa_id = l.pessoa_id AND p.fim IS NULL`,
      [s.unidade_id],
    );
    for (const x of r.rows) {
      await this.nucleo.enfileirar(c, 'notificacao', {
        orgId: c.tx.orgId,
        pessoaId: x.pessoa_id,
        titulo,
        corpo: corpo.slice(0, 140),
        dados: { tipo: 'reserva', solicitacaoId: s.id },
        alta: false,
      });
    }
  }
}
