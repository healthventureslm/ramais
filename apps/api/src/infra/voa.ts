import { BadRequestException } from '@nestjs/common';

/**
 * API de parceiros da VOA (rms.voahoteis.io): dados do hotel, disponibilidade e oferta com link de
 * pagamento no checkout da VOA (book.salabim.ai). O token fica só no servidor.
 */

export interface QuartoBusca {
  adultos: number;
  idadesCriancas: number[];
}

export interface TarifaVoa {
  quartoId: number;
  quartoNome: string;
  tarifaId: number;
  tarifaNome: string;
  /** ONLY_HOSTING, HOSTING_WITH_BREAKFAST… */
  regime: string;
  regimeNome: string;
  cancelavel: boolean;
  cancelamentoAte: string | null;
  cancelamentoTexto: string | null;
  noites: number;
  /** Total da estadia (todos os quartos), já com ISS. */
  total: number;
}

export interface BuscaVoa {
  ok: boolean;
  /** id_search e validade (30 min). */
  id: string | null;
  expira: string | null;
  motivo: string | null;
  tarifas: TarifaVoa[];
}

export interface OfertaVoa {
  id: number;
  uuid: string;
  total: number;
  expira: string;
  bookingId: string | null;
  link: string;
}

export class ErroVoa extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErroVoa';
  }
}

type Fetch = typeof fetch;

export class ClienteVoa {
  constructor(
    private readonly o: { url: string; token: string | null; checkout?: string; fetch?: Fetch },
  ) {}

  get disponivel(): boolean {
    return Boolean(this.o.token);
  }

  private async chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<{ status: boolean; data: T; error?: unknown }> {
    if (!this.o.token) throw new ErroVoa(0, 'integração da VOA sem token');
    const f = this.o.fetch ?? fetch;
    const r = await f(`${this.o.url.replace(/\/$/, '')}${caminho}`, {
      method: metodo,
      headers: { authorization: `Bearer ${this.o.token}`, ...(corpo ? { 'content-type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await r.text();
    let j: { status: boolean; data: T; error?: unknown; message?: string } | null = null;
    try {
      j = JSON.parse(texto);
    } catch {
      // resposta não JSON
    }
    if (!r.ok || !j) {
      const msg = (j && (j.message ?? (j.error as { message?: string } | undefined)?.message)) || texto.slice(0, 200);
      throw new ErroVoa(r.status, `VOA ${r.status}: ${msg}`);
    }
    return j;
  }

  /** Nome do hotel na VOA (confere o ID e o acesso do token antes de ligar a integração). */
  async nomeDoHotel(hotelId: number): Promise<string> {
    try {
      const j = await this.chamar<{ name?: string }>('GET', `/api/ota/hotel/${hotelId}`);
      if (!j.status || !j.data?.name) throw new ErroVoa(404, 'hotel não encontrado');
      return j.data.name;
    } catch (e) {
      if (e instanceof ErroVoa && (e.status === 401 || e.status === 404)) {
        throw new BadRequestException(`a VOA não reconhece o hotel ${hotelId} para este token`);
      }
      throw e;
    }
  }

  /**
   * Disponibilidade para as datas e a ocupação, com o preço final por tarifa (soma dos quartos,
   * já com ISS: a VOA manda sem quando price_include_iss_tax é false).
   */
  async buscar(hotelId: number, checkIn: string, checkOut: string, quartos: QuartoBusca[]): Promise<BuscaVoa> {
    const q = new URLSearchParams({
      checkIn,
      checkOut,
      rooms: String(quartos.length),
      adults: quartos.map((x) => x.adultos).join(','),
    });
    if (quartos.some((x) => x.idadesCriancas.length)) {
      q.set('childs', quartos.map((x) => x.idadesCriancas.length).join(','));
      q.set('ageChilds', JSON.stringify(quartos.map((x) => x.idadesCriancas)));
    }
    const j = await this.chamar<{
      search?: { id?: string; expires?: string };
      reason?: string;
      rooms?: {
        room: { id: number; name: string };
        nights: number;
        rates: {
          id: number;
          name: string;
          type: string;
          type_formated?: string;
          iss_tax?: number | null;
          price_include_iss_tax?: boolean;
          cancelable?: { can_cancel?: boolean; final_date_for_cancellation?: string | null; description?: string | null };
          prices: { room: number; total: number }[];
        }[];
      }[];
    }>('GET', `/api/ota/hotel/${hotelId}/search?${q}`);
    const d = j.data ?? {};
    const tarifas: TarifaVoa[] = [];
    for (const q2 of d.rooms ?? []) {
      for (const t of q2.rates ?? []) {
        const iss = t.price_include_iss_tax ? 0 : (t.iss_tax ?? 5);
        const soma = (t.prices ?? []).reduce((s, p) => s + (p.total ?? 0), 0);
        if (!soma) continue;
        tarifas.push({
          quartoId: q2.room.id,
          quartoNome: q2.room.name,
          tarifaId: t.id,
          tarifaNome: t.name,
          regime: t.type,
          regimeNome: t.type_formated ?? t.type,
          cancelavel: t.cancelable?.can_cancel === true,
          cancelamentoAte: t.cancelable?.final_date_for_cancellation ?? null,
          cancelamentoTexto: t.cancelable?.description ?? null,
          noites: q2.nights,
          total: Math.round(soma * (1 + iss / 100) * 100) / 100,
        });
      }
    }
    tarifas.sort((a, b) => a.total - b.total);
    return { ok: j.status === true && tarifas.length > 0, id: d.search?.id ?? null, expira: d.search?.expires ?? null, motivo: d.reason ?? null, tarifas };
  }

  /** Cria a oferta (segura o preço) e devolve o link do checkout da VOA. */
  async criarOferta(p: {
    hotelId: number;
    buscaId: string;
    checkIn: string;
    checkOut: string;
    quartos: QuartoBusca[];
    quartoId: number;
    tarifaId: number;
    nome: string | null;
    email: string | null;
    telefone: string | null;
    expiraEm: Date;
    criadoPor: string;
  }): Promise<OfertaVoa> {
    const j = await this.chamar<{ id: number; uuid: string; total: number; expires: string; booking_id?: string | null }>(
      'POST',
      `/api/ota/hotel/${p.hotelId}/offer`,
      {
        channel: 'MOTOR_RESERVAS',
        create_salabim_link: false,
        id_search: p.buscaId,
        check_in: p.checkIn,
        check_out: p.checkOut,
        rate_id: p.tarifaId,
        rooms: p.quartos.map((q, i) => ({
          indice: i + 1,
          id: p.quartoId,
          rate_id: p.tarifaId,
          adults: q.adultos,
          children: q.idadesCriancas.length,
          ageChilds: q.idadesCriancas,
        })),
        ...(p.nome ? { name: p.nome } : {}),
        ...(p.email ? { email: p.email } : {}),
        ...(p.telefone ? { phone: p.telefone } : {}),
        created_by: p.criadoPor,
        expires_at: p.expiraEm.toISOString(),
      },
    );
    if (!j.status || !j.data?.uuid) throw new ErroVoa(200, 'a VOA não devolveu a oferta');
    const q = new URLSearchParams();
    if (p.nome) q.set('name', p.nome);
    if (p.email) q.set('email', p.email);
    if (p.telefone) q.set('phone', p.telefone);
    const base = (this.o.checkout ?? 'https://book.salabim.ai').replace(/\/$/, '');
    return {
      id: j.data.id,
      uuid: j.data.uuid,
      total: Number(j.data.total),
      expira: j.data.expires,
      bookingId: j.data.booking_id ?? null,
      link: `${base}/central/checkout/${encodeURIComponent(j.data.uuid)}${q.size ? `?${q}` : ''}`,
    };
  }
}
