import { lerJson, type ClienteChat, type PedidoChat } from './openrouter.js';

/**
 * Atendente de pedidos pela conversa: o hóspede pergunta e pede em linguagem natural ("quais
 * passeios tem?", "um hambúrguer sem cebola e uma água", "só isso"). A IA só lê a intenção e
 * aponta os itens pelo código; nomes, preços, horários e total vêm do catálogo, no servidor.
 */

export type IntencaoPedido = 'browse' | 'add' | 'remove' | 'checkout' | 'confirm' | 'cancel' | 'answer' | 'other';

export interface ExtracaoPedido {
  /** A mensagem é sobre pedir/reservar algo do catálogo ou responde à conversa do pedido. */
  sobreCatalogo: boolean;
  intencao: IntencaoPedido;
  /** Itens que respondem à pergunta ("quais passeios tem?"): códigos do catálogo. */
  mostrar: string[];
  adicionar: { codigo: string; quantidade: number | null; observacao: string | null }[];
  remover: string[];
  data: string | null;
  hora: string | null;
  pessoas: number | null;
  sim: boolean;
  nao: boolean;
  /** O que o hóspede pediu e não existe no catálogo, nas palavras dele ("cerveja"). */
  naoTem: string[];
  /** Como quer pagar, quando perguntado: na conta do quarto ou agora (link de Pix ou cartão). */
  pagamento: 'quarto' | 'agora' | null;
  modelo: string;
}

export interface ContextoPedido {
  hoje: string;
  diaSemana: string;
  /** "c1: [Room service] Club sandwich, R$ 68,00 (purchase). Pão de forma…" */
  catalogo: string[];
  /** O que já está no pedido, em texto. */
  carrinho: string[];
  pergunta: string | null;
}

export interface ExtratorPedido {
  readonly disponivel: boolean;
  extrair(texto: string, ctx: ContextoPedido): Promise<ExtracaoPedido>;
}

const INTENCOES: IntencaoPedido[] = ['browse', 'add', 'remove', 'checkout', 'confirm', 'cancel', 'answer', 'other'];

/** Chamada com JSON estrito; se o provedor devolver vazio, de novo sem o esquema (pedindo pelas instruções). */
export async function chatJson(cliente: ClienteChat, pedido: PedidoChat & { esquema: NonNullable<PedidoChat['esquema']> }) {
  try {
    const r = await cliente.chat(pedido);
    return { j: lerJson(r.conteudo) as Record<string, unknown>, modelo: r.modelo };
  } catch {
    const { esquema, ...sem } = pedido;
    const chaves = Object.keys((esquema.schema as { properties: object }).properties).join(', ');
    const [sistema, ...resto] = pedido.mensagens;
    const r = await cliente.chat({
      ...sem,
      mensagens: [{ role: 'system', content: `${sistema!.content}\nReply ONLY with a JSON object with exactly these keys: ${chaves}.` }, ...resto],
    });
    return { j: lerJson(r.conteudo) as Record<string, unknown>, modelo: r.modelo };
  }
}

export class ExtratorPedidoLLM implements ExtratorPedido {
  readonly disponivel = true;

  constructor(
    private readonly cliente: ClienteChat,
    private readonly modelo: string,
  ) {}

  async extrair(texto: string, ctx: ContextoPedido): Promise<ExtracaoPedido> {
    const sistema = [
      'You help a hotel guest order or book services from the hotel catalog below (room service, drinks, amenities, spa, tours, transfers, restaurant tables) through chat.',
      'You do NOT write replies. You only read the guest message and say what they want, pointing to catalog items by their code (c1, c2…). Never invent items.',
      `Today at the hotel is ${ctx.hoje} (${ctx.diaSemana}). Resolve relative dates to YYYY-MM-DD and times to HH:MM (24h).`,
      'about_catalog: true if the guest asks about, wants or answers about something in the catalog, or replies to the ordering conversation ("yes", "no", "just that", a date, a time, a number of people). Complaints, maintenance problems and room bookings (a stay at the hotel) are NOT catalog.',
      'intent:',
      '- browse: asks what there is or about items ("which tours do you have?", "what is there to eat?", "anything vegetarian?"). Put in items_to_show the codes that answer it (empty if they want everything).',
      '- add: wants items. Put them in add, with quantity and a short note only if said. The note is only a preparation detail ("no onions", "with ice", "one without bacon"); never the item name or the quantity.',
      'not_found: things the guest asked for that are NOT in the catalog, in the guest\'s words. Never put them in add as a different item (a beer is not a water).',
      '- remove: wants to take items out of the order.',
      '- checkout: says they are done ("that is all", "just that", "no, thanks" after being asked if they want anything else, "close the order").',
      '- confirm: confirms the order summary ("yes", "confirm", "ok", or says how they will pay).',
      '- cancel: gives up the whole order.',
      '- answer: answers a question about date, time or number of people.',
      '- other: none of the above.',
      'date/time/people: when stated. yes/no: when the message is a yes or a no.',
      'payment: when asked how to pay, "room" = charge to the room bill, "now" = pay now by Pix or card (a link); null if not said.',
      'Catalog:',
      ...ctx.catalogo,
      ctx.carrinho.length ? `Current order:\n${ctx.carrinho.join('\n')}` : 'Current order: empty.',
      ctx.pergunta ? `Last question asked to the guest: ${ctx.pergunta}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const nulo = (tipo: string) => ({ type: [tipo, 'null'] });
    const { j, modelo } = await chatJson(this.cliente, {
      modelo: this.modelo,
      tarefa: 'pedido',
      mensagens: [
        { role: 'system', content: sistema },
        { role: 'user', content: texto },
      ],
      esquema: {
        nome: 'pedido',
        schema: {
          type: 'object',
          properties: {
            about_catalog: { type: 'boolean' },
            intent: { type: 'string', enum: INTENCOES },
            items_to_show: { type: 'array', items: { type: 'string' } },
            add: {
              type: 'array',
              items: {
                type: 'object',
                properties: { code: { type: 'string' }, quantity: nulo('integer'), note: nulo('string') },
                required: ['code', 'quantity', 'note'],
                additionalProperties: false,
              },
            },
            remove: { type: 'array', items: { type: 'string' } },
            date: nulo('string'),
            time: nulo('string'),
            people: nulo('integer'),
            yes: { type: 'boolean' },
            no: { type: 'boolean' },
            not_found: { type: 'array', items: { type: 'string' } },
            payment: { type: ['string', 'null'], enum: ['room', 'now', null] },
          },
          required: ['about_catalog', 'intent', 'items_to_show', 'add', 'remove', 'date', 'time', 'people', 'yes', 'no', 'not_found', 'payment'],
          additionalProperties: false,
        },
      },
      maxTokens: 1500,
      timeoutMs: 15_000,
      raciocinio: 'minimal',
    });
    const codigos = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^c\d+$/.test(x)) : []);
    const intencao = INTENCOES.includes(j.intent as IntencaoPedido) ? (j.intent as IntencaoPedido) : 'other';
    const adicionar = Array.isArray(j.add)
      ? (j.add as Record<string, unknown>[])
          .filter((a) => typeof a.code === 'string' && /^c\d+$/.test(a.code))
          .map((a) => ({
            codigo: a.code as string,
            quantidade: typeof a.quantity === 'number' && Number.isInteger(a.quantity) && a.quantity > 0 && a.quantity <= 100 ? a.quantity : null,
            observacao: typeof a.note === 'string' && a.note.trim() ? a.note.trim().slice(0, 200) : null,
          }))
      : [];
    const data = typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) && j.date >= ctx.hoje ? j.date : null;
    const hora = typeof j.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(j.time) ? j.time : null;
    return {
      sobreCatalogo: j.about_catalog === true,
      intencao,
      mostrar: codigos(j.items_to_show),
      adicionar,
      remover: codigos(j.remove),
      data,
      hora,
      pessoas: typeof j.people === 'number' && Number.isInteger(j.people) && j.people > 0 && j.people <= 100 ? j.people : null,
      sim: j.yes === true,
      nao: j.no === true,
      naoTem: Array.isArray(j.not_found) ? j.not_found.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map((x) => x.trim().slice(0, 60)).slice(0, 5) : [],
      pagamento: j.payment === 'room' ? 'quarto' : j.payment === 'now' ? 'agora' : null,
      modelo,
    };
  }
}

export class ExtratorPedidoNulo implements ExtratorPedido {
  readonly disponivel = false;
  async extrair(): Promise<ExtracaoPedido> {
    throw new Error('sem IA para pedidos');
  }
}
