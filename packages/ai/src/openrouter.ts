import { ErroMotor } from '@ramais/contracts';

/**
 * Cliente mínimo do OpenRouter (API compatível com chat completions).
 * Todos os modelos passam por aqui, então trocar ou comparar motores é configuração.
 */

export type ParteConteudo =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

export interface MensagemChat {
  role: 'system' | 'user' | 'assistant';
  content: string | ParteConteudo[];
}

export interface TokenLogprob {
  token: string;
  logprob: number;
  top_logprobs?: { token: string; logprob: number }[];
}

export interface PedidoChat {
  modelo: string;
  /** Nome da tarefa no registro de gasto (padrão: o nome do esquema). */
  tarefa?: string;
  mensagens: MensagemChat[];
  /** JSON schema estrito da resposta. */
  esquema?: { nome: string; schema: Record<string, unknown> };
  temperatura?: number;
  maxTokens?: number;
  logprobs?: boolean;
  topLogprobs?: number;
  timeoutMs?: number;
}

export interface RespostaChat {
  conteudo: string;
  modelo: string;
  logprobs: TokenLogprob[] | null;
  tokensEntrada: number;
  tokensSaida: number;
}

export interface ClienteChat {
  chat(p: PedidoChat): Promise<RespostaChat>;
}

// ---------- Decisions API (modelos de decisão, como o Jev da TypeSafe) ----------

export type PerguntaDecisao =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } };

export type RespostaDecisao =
  | { type: 'choice'; choice: string; confidence?: number; probabilities?: Record<string, number> }
  | { type: 'noul'; noul: number };

export interface PedidoDecisoes {
  modelo: string;
  estado: string | Record<string, unknown>;
  perguntas: Record<string, PerguntaDecisao>;
  timeoutMs?: number;
}

export interface ClienteDecisoes {
  decisoes(p: PedidoDecisoes): Promise<{ respostas: Record<string, RespostaDecisao>; modelo: string; custo: number | null }>;
}

/** Uma chamada à OpenRouter, para medir gasto: custo em dólares quando a OpenRouter informa. */
export interface UsoIA {
  /** O que a chamada fazia: o nome do esquema (roteamento, traducao, transcricao…) ou "decisoes". */
  tarefa: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number | null;
  latenciaMs: number;
  ok: boolean;
}

export interface OpcoesOpenRouter {
  apiKey: string;
  /** Chamado depois de cada chamada (também nas que falham), para registrar o gasto. */
  aoUsar?: (u: UsoIA) => void;
  baseUrl?: string;
  /** Só provedores que não retêm nem treinam com os dados (LGPD). */
  semRetencao?: boolean;
  fetch?: typeof fetch;
  appNome?: string;
}

export class ClienteOpenRouter implements ClienteChat, ClienteDecisoes {
  private readonly base: string;
  private readonly f: typeof fetch;

  constructor(private readonly o: OpcoesOpenRouter) {
    this.base = o.baseUrl ?? 'https://openrouter.ai/api/v1';
    this.f = o.fetch ?? fetch;
  }

  async chat(p: PedidoChat): Promise<RespostaChat> {
    const corpo: Record<string, unknown> = {
      model: p.modelo,
      messages: p.mensagens,
      temperature: p.temperatura ?? 0,
      max_tokens: p.maxTokens ?? 512,
      // Pede o custo da chamada na resposta (contabilidade da OpenRouter).
      usage: { include: true },
    };
    if (p.esquema) {
      corpo.response_format = {
        type: 'json_schema',
        json_schema: { name: p.esquema.nome, strict: true, schema: p.esquema.schema },
      };
    }
    if (p.logprobs) {
      corpo.logprobs = true;
      corpo.top_logprobs = p.topLogprobs ?? 5;
    }
    const provider: Record<string, unknown> = {};
    if (this.o.semRetencao) provider.data_collection = 'deny';
    if (p.logprobs || p.esquema) provider.require_parameters = true;
    if (Object.keys(provider).length) corpo.provider = provider;

    const inicio = Date.now();
    const tarefa = p.tarefa ?? p.esquema?.nome ?? 'chat';
    const falhou = () => this.usou({ tarefa, modelo: p.modelo, tokensEntrada: 0, tokensSaida: 0, custoUsd: null, latenciaMs: Date.now() - inicio, ok: false });
    let resp: Response;
    try {
      resp = await this.f(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.o.apiKey}`,
          'content-type': 'application/json',
          'x-title': this.o.appNome ?? 'ramais',
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(p.timeoutMs ?? 15_000),
      });
    } catch (e) {
      falhou();
      const nome = (e as Error).name;
      if (nome === 'TimeoutError' || nome === 'AbortError') throw new ErroMotor('timeout', `timeout em ${p.modelo}`);
      throw new ErroMotor('indisponivel', `falha de rede: ${(e as Error).message}`);
    }
    if (!resp.ok) {
      falhou();
      const texto = await resp.text().catch(() => '');
      throw new ErroMotor('indisponivel', `OpenRouter ${resp.status}: ${texto.slice(0, 300)}`);
    }
    const json = (await resp.json()) as {
      model?: string;
      choices?: { message?: { content?: string }; logprobs?: { content?: TokenLogprob[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      error?: { message?: string };
    };
    this.usou({
      tarefa,
      modelo: json.model ?? p.modelo,
      tokensEntrada: json.usage?.prompt_tokens ?? 0,
      tokensSaida: json.usage?.completion_tokens ?? 0,
      custoUsd: typeof json.usage?.cost === 'number' ? json.usage.cost : null,
      latenciaMs: Date.now() - inicio,
      ok: !json.error,
    });
    const escolha = json.choices?.[0];
    const conteudo = escolha?.message?.content;
    if (json.error || typeof conteudo !== 'string') {
      throw new ErroMotor('saida_invalida', json.error?.message ?? 'resposta sem conteúdo');
    }
    return {
      conteudo,
      modelo: json.model ?? p.modelo,
      logprobs: escolha?.logprobs?.content ?? null,
      tokensEntrada: json.usage?.prompt_tokens ?? 0,
      tokensSaida: json.usage?.completion_tokens ?? 0,
    };
  }

  private usou(u: UsoIA) {
    try {
      this.o.aoUsar?.(u);
    } catch {
      // medir gasto nunca derruba a chamada
    }
  }

  /** POST /api/alpha/decisions: perguntas tipadas, respostas com probabilidade por opção. */
  async decisoes(p: PedidoDecisoes) {
    const corpo: Record<string, unknown> = { model: p.modelo, state: p.estado, questions: p.perguntas };
    if (this.o.semRetencao) corpo.provider = { data_collection: 'deny' };
    const raiz = this.base.replace(/\/v1\/?$/, '');
    const inicio = Date.now();
    const falhou = () => this.usou({ tarefa: 'decisoes', modelo: p.modelo, tokensEntrada: 0, tokensSaida: 0, custoUsd: null, latenciaMs: Date.now() - inicio, ok: false });
    let resp: Response;
    try {
      resp = await this.f(`${raiz}/alpha/decisions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.o.apiKey}`,
          'content-type': 'application/json',
          'x-title': this.o.appNome ?? 'ramais',
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(p.timeoutMs ?? 8000),
      });
    } catch (e) {
      const nome = (e as Error).name;
      if (nome === 'TimeoutError' || nome === 'AbortError') throw new ErroMotor('timeout', `timeout em ${p.modelo}`);
      falhou();
      throw new ErroMotor('indisponivel', `falha de rede: ${(e as Error).message}`);
    }
    if (!resp.ok) {
      falhou();
      const texto = await resp.text().catch(() => '');
      throw new ErroMotor('indisponivel', `Decisions ${resp.status}: ${texto.slice(0, 300)}`);
    }
    const json = (await resp.json()) as {
      model?: string;
      answers?: Record<string, RespostaDecisao>;
      usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };
    this.usou({
      tarefa: 'decisoes',
      modelo: json.model ?? p.modelo,
      tokensEntrada: json.usage?.prompt_tokens ?? 0,
      tokensSaida: json.usage?.completion_tokens ?? 0,
      custoUsd: typeof json.usage?.cost === 'number' ? json.usage.cost : null,
      latenciaMs: Date.now() - inicio,
      ok: !json.error && Boolean(json.answers),
    });
    if (json.error || !json.answers) throw new ErroMotor('saida_invalida', json.error?.message ?? 'resposta sem answers');
    return { respostas: json.answers, modelo: json.model ?? p.modelo, custo: json.usage?.cost ?? null };
  }
}

/** Extrai o primeiro objeto JSON de um texto (alguns provedores embrulham em ```json). */
export function lerJson(texto: string): unknown {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(limpo);
  } catch {
    const i = limpo.indexOf('{');
    const f = limpo.lastIndexOf('}');
    if (i >= 0 && f > i) return JSON.parse(limpo.slice(i, f + 1));
    throw new ErroMotor('saida_invalida', 'JSON inválido');
  }
}
