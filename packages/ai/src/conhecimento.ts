import type { ItemConhecimento } from '@ramais/contracts';
import { normalizar } from '@ramais/domain';
import { lerJson, type ClienteChat } from './openrouter.js';

/**
 * Respostas automáticas só a partir da base de conhecimento: a IA informa, não age.
 * Se a base não cobre a pergunta, não responde, e a mensagem segue para o roteamento.
 */

export interface RespostaConhecimento {
  responde: boolean;
  /** Em português; o chamador traduz para o idioma do solicitante. */
  resposta: string | null;
  fontes: string[];
  confianca: number;
  modelo: string;
}

export interface Respondedor {
  responder(pergunta: string, itens: ItemConhecimento[]): Promise<RespostaConhecimento>;
}

const NAO: RespostaConhecimento = { responde: false, resposta: null, fontes: [], confianca: 0, modelo: 'nenhum' };

export class RespondedorLLM implements Respondedor {
  constructor(
    private readonly cliente: ClienteChat,
    private readonly modelo: string,
    private readonly amostras = 2,
  ) {}

  async responder(pergunta: string, itens: ItemConhecimento[]): Promise<RespostaConhecimento> {
    if (itens.length === 0) return NAO;
    const base = itens.map((i) => `[${i.id}] Q: ${i.pergunta}\nA: ${i.resposta}`).join('\n\n');
    const sistema = [
      'You answer guest questions using ONLY the knowledge base below.',
      'If the message is a request for something to be done (bring, fix, book, send, change), it is NOT a question: answer=false.',
      // "Preciso da nota em nome da XPTO, CNPJ ..." recebia "A nota será emitida em nome da XPTO":
      // a IA prometia o que não faz e o pedido nunca chegava à recepção.
      'If the person gives details for staff to act on (a time, a name, a document or company number, a room) or reports a problem, it is a request: answer=false.',
      'Never promise that something will be done; only inform what the knowledge base says.',
      'If the knowledge base does not fully answer the question, answer=false. Never guess.',
      'When answering, write a short reply in Brazilian Portuguese and list the ids you used.',
      'Reply with JSON {"answer": boolean, "reply": string, "sources": string[]}.',
      '',
      base,
    ].join('\n');
    const pedido = {
      modelo: this.modelo,
      mensagens: [
        { role: 'system' as const, content: sistema },
        { role: 'user' as const, content: pergunta },
      ],
      esquema: {
        nome: 'resposta',
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'boolean' },
            reply: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['answer', 'reply', 'sources'],
          additionalProperties: false,
        },
      },
      maxTokens: 400,
      timeoutMs: 12_000,
    };
    const res = await Promise.allSettled(
      Array.from({ length: this.amostras }, (_, i) => this.cliente.chat({ ...pedido, temperatura: i === 0 ? 0 : 0.7 })),
    );
    const ids = new Set(itens.map((i) => i.id));
    const lidas = res.flatMap((r) => {
      if (r.status !== 'fulfilled') return [];
      try {
        const j = lerJson(r.value.conteudo) as { answer?: boolean; reply?: string; sources?: string[] };
        const fontes = (j.sources ?? []).filter((s) => ids.has(s));
        const valida = j.answer === true && Boolean(j.reply?.trim()) && fontes.length > 0;
        return [{ valida, reply: j.reply?.trim() ?? '', fontes, modelo: r.value.modelo }];
      } catch {
        return [];
      }
    });
    const primeira = lidas[0];
    if (!primeira?.valida) return NAO;
    // Autoconsistência: as amostras precisam concordar em responder e nas fontes.
    const concordam = lidas.filter((l) => l.valida && l.fontes.some((f) => primeira.fontes.includes(f))).length;
    return {
      responde: true,
      resposta: primeira.reply,
      fontes: primeira.fontes,
      confianca: concordam / this.amostras,
      modelo: primeira.modelo,
    };
  }
}

/** Sem IA: só responde quando a pergunta cita uma tag e tem cara de pergunta. */
export class RespondedorPalavras implements Respondedor {
  async responder(pergunta: string, itens: ItemConhecimento[]): Promise<RespostaConhecimento> {
    const t = normalizar(pergunta);
    const ehPergunta =
      /\?/.test(pergunta) ||
      /^(qual|quais|que horas|quando|onde|como|tem|existe|cual|cuando|donde|hay|what|when|where|how|is there|do you)\b/.test(t);
    if (!ehPergunta) return NAO;
    const achados = itens.filter((i) => i.tags.some((tag) => ` ${t} `.includes(` ${normalizar(tag)} `)));
    if (achados.length !== 1) return NAO;
    const item = achados[0]!;
    return { responde: true, resposta: item.resposta, fontes: [item.id], confianca: 0.85, modelo: 'regras' };
  }
}
