import { lerJson, type ClienteChat } from './openrouter.js';

/**
 * Reserva de hospedagem pela conversa: o que a mensagem do hóspede diz sobre a estadia que ele
 * quer (datas, pessoas, quartos), a opção escolhida, o nome e o e-mail do titular. Só extrai;
 * quem decide o próximo passo é o fluxo de reserva no servidor.
 */

export interface ExtracaoReserva {
  /** A mensagem é sobre reservar hospedagem, ver preço ou disponibilidade, ou estender a estadia. */
  querReservar: boolean;
  /** A mensagem tem a ver com a reserva em andamento (responde a uma pergunta dela). */
  sobreReserva: boolean;
  /** O hóspede desistiu ("deixa pra lá", "não quero mais"). */
  desiste: boolean;
  /** Quer estender a estadia atual (a entrada é o dia do check-out atual). */
  estender: boolean;
  checkIn: string | null;
  checkOut: string | null;
  /** Noites, quando ele diz quantas mas não a saída ("3 noites a partir de sexta"). */
  noites: number | null;
  quartos: number | null;
  adultos: number | null;
  criancas: number | null;
  idadesCriancas: number[];
  /** Número da opção escolhida (1, 2…), quando há opções na mesa. */
  escolha: number | null;
  nome: string | null;
  email: string | null;
  /** Respondeu "sim" à última pergunta (confirma a cotação). */
  sim: boolean;
  modelo: string;
}

export interface ContextoReserva {
  /** Hoje no hotel (AAAA-MM-DD) e o dia da semana, para "sexta que vem", "amanhã". */
  hoje: string;
  diaSemana: string;
  /** O que já se sabe da reserva em andamento (para a IA não perguntar de novo). */
  conhecido?: Record<string, unknown> | null;
  /** Opções mostradas ao hóspede, numeradas (para "a segunda", "a mais barata", "a suíte"). */
  opcoes?: string[];
  /** Última pergunta feita ao hóspede. */
  pergunta?: string | null;
}

export interface ExtratorReserva {
  readonly disponivel: boolean;
  extrair(texto: string, ctx: ContextoReserva): Promise<ExtracaoReserva>;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);

export class ExtratorReservaLLM implements ExtratorReserva {
  readonly disponivel = true;

  constructor(
    private readonly cliente: ClienteChat,
    private readonly modelo: string,
  ) {}

  async extrair(texto: string, ctx: ContextoReserva): Promise<ExtracaoReserva> {
    const sistema = [
      'You read one message from a hotel guest and extract booking information for a ROOM RESERVATION (a stay at the hotel).',
      `Today at the hotel is ${ctx.hoje} (${ctx.diaSemana}). Resolve relative dates ("next Friday", "tomorrow", "10 to 13 of December") to YYYY-MM-DD; dates are always in the future. If only day numbers are given, use the next occurrence.`,
      'wants_booking: true if the guest wants to book a room, check availability or prices for a stay, or extend the current stay. Room service, spa, tours, restaurant tables or complaints are NOT room bookings.',
      'about_booking: true if the message answers or relates to the booking conversation below (dates, people, children ages, choosing an option, name, e-mail, "yes", "ok").',
      'quits: true only if the guest says they no longer want to book.',
      'extend: true if they want to stay more nights in the stay they already have. When extending, check_in is the CURRENT check-out date (where the extra nights start) and check_out is the NEW check-out date; "my check-out is on the 30th" is check_in.',
      'nights: number of nights if stated without a check-out date.',
      'choice: the number of the chosen option when options were shown (the guest may answer "2", "the second", "the cheapest", or a room name).',
      'adults/children: totals for the whole booking; children_ages: one age per child, only if stated.',
      'name: full name of the person the booking is for, only if the guest states it. email: only if stated.',
      'yes: true if the message is a yes / confirmation to the last question ("yes", "ok", "confirm", "go ahead").',
      'Use null for anything not stated. Never invent values.',
      ctx.conhecido ? `Already known about this booking: ${JSON.stringify(ctx.conhecido)}` : '',
      ctx.opcoes?.length ? `Options shown to the guest:\n${ctx.opcoes.map((o, i) => `${i + 1}. ${o}`).join('\n')}` : '',
      ctx.pergunta ? `Last question asked to the guest: ${ctx.pergunta}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const nulo = (tipo: string) => ({ type: [tipo, 'null'] });
    const pedido = {
      modelo: this.modelo,
      tarefa: 'reserva',
      mensagens: [
        { role: 'system', content: sistema },
        { role: 'user', content: texto },
      ],
      esquema: {
        nome: 'reserva',
        schema: {
          type: 'object',
          properties: {
            wants_booking: { type: 'boolean' },
            about_booking: { type: 'boolean' },
            quits: { type: 'boolean' },
            extend: { type: 'boolean' },
            check_in: nulo('string'),
            check_out: nulo('string'),
            nights: nulo('integer'),
            rooms: nulo('integer'),
            adults: nulo('integer'),
            children: nulo('integer'),
            children_ages: { type: 'array', items: { type: 'integer' } },
            choice: nulo('integer'),
            name: nulo('string'),
            email: nulo('string'),
            yes: { type: 'boolean' },
          },
          required: ['wants_booking', 'about_booking', 'quits', 'extend', 'check_in', 'check_out', 'nights', 'rooms', 'adults', 'children', 'children_ages', 'choice', 'name', 'email', 'yes'],
          additionalProperties: false,
        },
      },
      maxTokens: 1500,
      timeoutMs: 15_000,
      raciocinio: 'minimal',
    } as const;
    // O modelo às vezes devolve vazio: uma segunda tentativa resolve quase sempre.
    let r;
    let j: Record<string, unknown>;
    try {
      r = await this.cliente.chat({ ...pedido, mensagens: [...pedido.mensagens] });
      j = lerJson(r.conteudo) as Record<string, unknown>;
    } catch {
      // Alguns provedores devolvem vazio com o esquema estrito: sem ele, pedindo o JSON pelas instruções.
      const { esquema, ...semEsquema } = pedido;
      const chaves = Object.keys(esquema.schema.properties).join(', ');
      r = await this.cliente.chat({
        ...semEsquema,
        mensagens: [{ role: 'system', content: `${sistema}
Reply ONLY with a JSON object with exactly these keys: ${chaves}.` }, pedido.mensagens[1]],
      });
      j = lerJson(r.conteudo) as Record<string, unknown>;
    }
    const data = (v: unknown) => (typeof v === 'string' && ISO.test(v) && v >= ctx.hoje ? v : null);
    const idades = Array.isArray(j.children_ages) ? j.children_ages.filter((x): x is number => int(x, 0, 17) !== null) : [];
    const email = typeof j.email === 'string' && EMAIL.test(j.email.trim()) ? j.email.trim() : null;
    const nome = typeof j.name === 'string' && j.name.trim().length >= 3 ? j.name.trim().slice(0, 120) : null;
    return {
      querReservar: j.wants_booking === true,
      sobreReserva: j.about_booking === true,
      desiste: j.quits === true,
      estender: j.extend === true,
      checkIn: data(j.check_in),
      checkOut: data(j.check_out),
      noites: int(j.nights, 1, 60),
      quartos: int(j.rooms, 1, 10),
      adultos: int(j.adults, 1, 40),
      criancas: int(j.children, 0, 20),
      idadesCriancas: idades,
      escolha: int(j.choice, 1, 20),
      nome,
      email,
      sim: j.yes === true,
      modelo: r.modelo,
    };
  }
}

/** Sem IA: o fluxo de reserva automático fica desligado (a recepção atende). */
export class ExtratorReservaNulo implements ExtratorReserva {
  readonly disponivel = false;
  async extrair(): Promise<ExtracaoReserva> {
    throw new Error('sem IA para reserva');
  }
}

/**
 * Filtro barato antes de chamar a IA: a mensagem (ou a tradução para o inglês) fala de reserva,
 * disponibilidade, diária ou estender a estadia? Na dúvida, sim (a IA decide de verdade).
 */
export function pareceReserva(textos: (string | null | undefined)[]): boolean {
  const t = textos.filter(Boolean).join(' ').toLowerCase();
  // Sem `\b`: para ele, letra acentuada não é letra e "übernacht" nunca casaria. Chinês e japonês
  // não separam palavras: valem em qualquer posição.
  return /(?<!\p{L})(book|booking|reserv|availab|vacan|room for|rooms for|a room|stay|nights?|check[- ]?in|check[- ]?out|rate|price|how much|extend|one more (day|night)|another night|di[aá]ria|quartos?|reserv|vagas?|hospedagem|disponib|pernoit|estadia|estender|prorrog|noites?|habitaci|alojamiento|quedarme|noche|zimmer|übernacht|chambre|nuit|camera|notte)|予約|泊|空室|房间|预订|入住/iu.test(t);
}
