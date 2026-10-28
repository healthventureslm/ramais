/**
 * Links de pagamento do Salabim Pay (pay.salabim.ai): o hóspede paga por Pix ou cartão numa página
 * do provedor; a gente só cria o link e confere se foi pago. A chave fica só no servidor; com
 * sk_test_… tudo acontece no ambiente de testes (cartões e valores de teste).
 */

export type EstadoLink = 'aguardando' | 'paga' | 'expirada' | 'cancelada' | 'estornada';

export interface LinkPagamento {
  id: string;
  url: string | null;
  estado: EstadoLink;
  /** ACTIVE, PROCESSING, PAID… como o provedor manda. */
  status: string;
  valorCentavos: number;
  expiraEm: string | null;
  cobrancaProvedor: string | null;
}

export interface ItemLink {
  descricao: string;
  quantidade: number;
  totalCentavos: number;
}

export class ErroSalabim extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErroSalabim';
  }
}

const ESTADOS: Record<string, EstadoLink> = {
  ACTIVE: 'aguardando',
  PROCESSING: 'aguardando',
  PAID: 'paga',
  EXPIRED: 'expirada',
  CANCELED: 'cancelada',
  REFUNDED: 'estornada',
  PARTIALLY_REFUNDED: 'estornada',
};

interface LinkApi {
  id: string;
  url?: string;
  status: string;
  amount_cents: number;
  expires_at: string | null;
  charge_id?: string | null;
}

type Fetch = typeof fetch;

export class ClienteSalabim {
  constructor(private readonly o: { url: string; chave: string | null; fetch?: Fetch }) {}

  get disponivel(): boolean {
    return Boolean(this.o.chave);
  }

  /** Ambiente de testes (chave sk_test_…): o hóspede vê que é teste e paga com dados de teste. */
  get teste(): boolean {
    return Boolean(this.o.chave?.startsWith('sk_test_'));
  }

  private async chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown, idempotencia?: string): Promise<T> {
    if (!this.o.chave) throw new ErroSalabim(0, 'pagamento online sem chave');
    const f = this.o.fetch ?? fetch;
    const r = await f(`${this.o.url.replace(/\/$/, '')}${caminho}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${this.o.chave}`,
        ...(corpo ? { 'content-type': 'application/json' } : {}),
        ...(idempotencia ? { 'idempotency-key': idempotencia } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await r.text();
    let j: (T & { error?: { message?: string; code?: string }; message?: string }) | null = null;
    try {
      j = JSON.parse(texto);
    } catch {
      // resposta não JSON
    }
    if (!r.ok || !j) {
      const msg = (j && (j.error?.message ?? j.message ?? j.error?.code)) || texto.slice(0, 200);
      throw new ErroSalabim(r.status, `Salabim ${r.status}: ${msg}`);
    }
    return j;
  }

  private link(j: LinkApi): LinkPagamento {
    return {
      id: j.id,
      url: j.url ?? null,
      estado: ESTADOS[j.status] ?? 'aguardando',
      status: j.status,
      valorCentavos: j.amount_cents,
      expiraEm: j.expires_at,
      cobrancaProvedor: j.charge_id ?? null,
    };
  }

  /**
   * Cria o link (Pix ou cartão, à vista). Os itens aparecem no checkout e somam o valor. Com
   * `reserva`, o checkout mostra a estadia; conta sem hotelaria habilitada recusa, e aí vai sem.
   */
  async criarLink(p: {
    nome: string;
    itens: ItemLink[];
    expiraEm: Date;
    cliente?: { nome?: string | null; email?: string | null };
    reserva?: { checkIn: string; checkOut: string; codigo?: string | null; hospede?: string | null } | null;
    idempotencia: string;
  }): Promise<LinkPagamento> {
    const valor = p.itens.reduce((s, i) => s + i.totalCentavos, 0);
    if (valor <= 0) throw new ErroSalabim(0, 'valor zerado');
    const corpo = {
      name: p.nome.slice(0, 140),
      amount_cents: valor,
      payment_methods: ['PIX', 'CREDIT_CARD'],
      max_installments: 1,
      expires_at: p.expiraEm.toISOString(),
      ...(p.cliente?.nome ? { customer_name: p.cliente.nome.slice(0, 255) } : {}),
      ...(p.cliente?.email ? { customer_email: p.cliente.email } : {}),
      display: {
        price_is_final: true,
        line_items: p.itens.map((i) => ({
          kind: 'item',
          description: i.descricao.slice(0, 200),
          amount_cents: i.totalCentavos,
          quantity: i.quantidade,
          unit_amount_cents: Math.round(i.totalCentavos / i.quantidade),
        })),
      },
    };
    // O valor unitário arredondado pode não fechar com o total: a linha vai com quantidade 1.
    for (const l of corpo.display.line_items) {
      if (l.unit_amount_cents * l.quantity !== l.amount_cents) {
        l.description = `${l.quantity}× ${l.description}`;
        l.quantity = 1;
        l.unit_amount_cents = l.amount_cents;
      }
    }
    const reserva = p.reserva
      ? {
          check_in: p.reserva.checkIn,
          check_out: p.reserva.checkOut,
          ...(p.reserva.codigo ? { code: p.reserva.codigo } : {}),
          ...(p.reserva.hospede ? { guest_name: p.reserva.hospede } : {}),
        }
      : null;
    if (reserva) {
      try {
        return this.link(await this.chamar<LinkApi>('POST', '/payment-links', { ...corpo, reservation: reserva }, `${p.idempotencia}:r`));
      } catch (e) {
        if (!(e instanceof ErroSalabim) || (e.status !== 422 && e.status !== 403)) throw e;
      }
    }
    return this.link(await this.chamar<LinkApi>('POST', '/payment-links', corpo, p.idempotencia));
  }

  /** Situação do link (rota pública do provedor: o id do link é a credencial). */
  async consultar(id: string): Promise<LinkPagamento> {
    if (!/^pl_[A-Za-z0-9]+$/.test(id)) throw new ErroSalabim(0, 'id de link inválido');
    return this.link(await this.chamar<LinkApi>('GET', `/payment-links/${id}`));
  }
}
