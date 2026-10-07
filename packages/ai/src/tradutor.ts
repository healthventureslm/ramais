import { lerJson, type ClienteChat } from './openrouter.js';
import { detectarIdioma } from './idioma.js';

export interface Traducao {
  texto: string;
  idiomaOrigem: string;
  modelo: string;
  /** Números ou horários do original que sumiram na tradução. */
  alerta: string | null;
}

export interface Tradutor {
  readonly disponivel: boolean;
  traduzir(texto: string, para: string, opcoes?: { de?: string | null; glossario?: string[] }): Promise<Traducao>;
  /** Vários textos curtos de uma vez (ex.: os botões de uma tela), na mesma ordem. */
  traduzirLote(textos: string[], para: string): Promise<string[]>;
}

/** Nome do idioma em inglês para o modelo: qualquer código ISO ("ja" → "Japanese", "pt" → "Brazilian Portuguese"). */
export function nomeDoIdioma(codigo: string): string {
  if (codigo.toLowerCase().startsWith('pt')) return 'Brazilian Portuguese';
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** Números, horários e valores: "14h", "14:30", "302", "R$ 60", "6.30". */
export function numerosDe(texto: string): string[] {
  return [...texto.matchAll(/\d+(?:[.,:h]\d+)*/gi)].map((m) => m[0].replace(/[.,:h]/gi, ':'));
}

export function conferirNumeros(original: string, traducao: string): string | null {
  const a = numerosDe(original);
  const b = new Set(numerosDe(traducao));
  const faltando = a.filter((n) => !b.has(n));
  return faltando.length ? `conferir números: ${[...new Set(faltando)].join(', ')}` : null;
}

export class TradutorLLM implements Tradutor {
  readonly disponivel = true;

  constructor(
    private readonly cliente: ClienteChat,
    private readonly modelo: string,
  ) {}

  async traduzir(texto: string, para: string, o: { de?: string | null; glossario?: string[] } = {}): Promise<Traducao> {
    const destino = nomeDoIdioma(para);
    const sistema = [
      `Translate the user's message into ${destino}.`,
      'Keep meaning, tone and politeness. Keep numbers, times, room numbers, prices and names exactly as written.',
      o.glossario?.length ? `Never translate these terms: ${o.glossario.join(', ')}.` : '',
      'If the message is already in the target language, return it unchanged.',
      'Reply with JSON: {"source_language": ISO 639-1 code, "translation": string}.',
    ]
      .filter(Boolean)
      .join('\n');
    const r = await this.cliente.chat({
      modelo: this.modelo,
      mensagens: [
        { role: 'system', content: sistema },
        { role: 'user', content: texto },
      ],
      esquema: {
        nome: 'traducao',
        schema: {
          type: 'object',
          properties: { source_language: { type: 'string' }, translation: { type: 'string' } },
          required: ['source_language', 'translation'],
          additionalProperties: false,
        },
      },
      maxTokens: Math.min(2000, 200 + texto.length * 2),
      timeoutMs: 15_000,
    });
    const j = lerJson(r.conteudo) as { source_language?: string; translation?: string };
    const traducao = (j.translation ?? '').trim();
    if (!traducao) throw new Error('tradução vazia');
    // Texto devolvido igual = já estava no idioma de destino. O modelo erra o source_language
    // justamente aí ("Perfeito, e da piscina? Qual horário?" → pt saía com origem "en", 4 em 4),
    // e a conversa inteira passava a ser respondida em inglês. Igualdade não depende do modelo.
    const so = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const inalterado = so(traducao) === so(texto) && /\p{L}/u.test(texto);
    return {
      texto: traducao,
      idiomaOrigem: inalterado ? para.toLowerCase().slice(0, 2) : (j.source_language ?? o.de ?? detectarIdioma(texto).idioma).toLowerCase().slice(0, 2),
      modelo: r.modelo,
      alerta: conferirNumeros(texto, traducao),
    };
  }

  async traduzirLote(textos: string[], para: string): Promise<string[]> {
    if (!textos.length) return [];
    const r = await this.cliente.chat({
      modelo: this.modelo,
      mensagens: [
        {
          role: 'system',
          content: [
            `Translate each string of the JSON array into ${nomeDoIdioma(para)}. They are labels and short messages of a hotel guest chat app.`,
            'Keep the same order and the same number of items. Keep placeholders like {0} exactly as written. Keep it short and natural.',
            'Reply with JSON: {"translations": string[]}.',
          ].join(' '),
        },
        { role: 'user', content: JSON.stringify(textos) },
      ],
      esquema: {
        nome: 'traducoes',
        schema: {
          type: 'object',
          properties: { translations: { type: 'array', items: { type: 'string' } } },
          required: ['translations'],
          additionalProperties: false,
        },
      },
      maxTokens: Math.min(4000, 300 + JSON.stringify(textos).length * 3),
      timeoutMs: 30_000,
    });
    const j = lerJson(r.conteudo) as { translations?: unknown };
    const lista = Array.isArray(j.translations) ? j.translations : [];
    if (lista.length !== textos.length || lista.some((x) => typeof x !== 'string' || !x.trim())) throw new Error('lote traduzido incompleto');
    return lista as string[];
  }
}

/**
 * Tradução com reserva: se o modelo principal falhar (limite do provedor, fora do ar, tempo
 * esgotado, resposta inválida), a mesma tradução vai na hora para o próximo. Sem isso, a resposta
 * da equipe sairia em português para o hóspede.
 */
export class TradutorEmCadeia implements Tradutor {
  readonly disponivel = true;

  constructor(
    private readonly tradutores: Tradutor[],
    private readonly aoFalhar?: (indice: number, erro: unknown) => void,
  ) {}

  private async tentar<T>(fn: (t: Tradutor) => Promise<T>): Promise<T> {
    let ultimo: unknown;
    for (const [i, t] of this.tradutores.entries()) {
      try {
        return await fn(t);
      } catch (e) {
        ultimo = e;
        this.aoFalhar?.(i, e);
      }
    }
    throw ultimo;
  }

  traduzir(texto: string, para: string, opcoes?: { de?: string | null; glossario?: string[] }) {
    return this.tentar((t) => t.traduzir(texto, para, opcoes));
  }

  traduzirLote(textos: string[], para: string) {
    return this.tentar((t) => t.traduzirLote(textos, para));
  }
}

/** Sem IA: não traduz. A equipe vê o original com um aviso. */
export class TradutorNulo implements Tradutor {
  readonly disponivel = false;

  async traduzir(texto: string, _para: string, o: { de?: string | null } = {}): Promise<Traducao> {
    return { texto, idiomaOrigem: o.de ?? detectarIdioma(texto).idioma, modelo: 'nenhum', alerta: 'tradução indisponível' };
  }

  async traduzirLote(textos: string[]): Promise<string[]> {
    return textos;
  }
}
