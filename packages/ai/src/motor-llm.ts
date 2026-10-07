import { ErroMotor, type MotorDecisao, type Pergunta, type RespostaDecisao } from '@ramais/contracts';
import { lerJson, type ClienteChat, type TokenLogprob } from './openrouter.js';

/**
 * Motor de decisão sobre LLM: responde perguntas fechadas numa só chamada.
 * Cada opção vira uma letra, então a resposta de cada pergunta é um único token.
 *
 * Confiança, nunca a declarada pelo modelo em texto:
 *   - logprobs: probabilidade do token da letra escolhida (quando o provedor devolve).
 *   - autoconsistencia: N amostras em paralelo; a concordância é a confiança.
 */

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface OpcoesMotorLLM {
  cliente: ClienteChat;
  modelo: string;
  metodo: 'logprobs' | 'autoconsistencia';
  amostras?: number;
  timeoutMs?: number;
  /** Instruções do domínio (ex.: como ler o catálogo). */
  instrucoes?: string;
}

function letra(i: number): string {
  const l = LETRAS[i];
  if (!l) throw new Error('perguntas com mais de 26 opções não são suportadas');
  return l;
}

export function montarPrompt(estado: string, perguntas: Pergunta[], instrucoes = ''): { sistema: string; usuario: string } {
  const sistema = [
    'You are a decision component inside a service routing system.',
    'For each question, choose exactly one option by its letter. Never invent options.',
    'Reply only with the JSON object required by the schema.',
    instrucoes,
  ]
    .filter(Boolean)
    .join('\n');
  const blocos = perguntas.map((p) => {
    const ops = p.opcoes.map((o, i) => `  ${letra(i)}) ${o}`).join('\n');
    return `Question "${p.id}": ${p.texto}\n${ops}`;
  });
  return { sistema, usuario: `${estado}\n\n${blocos.join('\n\n')}` };
}

export function esquemaRespostas(perguntas: Pergunta[]): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const p of perguntas) props[p.id] = { type: 'string', enum: p.opcoes.map((_, i) => letra(i)) };
  return { type: 'object', properties: props, required: perguntas.map((p) => p.id), additionalProperties: false };
}

/**
 * Acha, nos logprobs, o token logo depois de `"<id>":"` e devolve a distribuição
 * sobre as letras válidas (renormalizada).
 */
export function distribuicaoPorLogprobs(
  tokens: TokenLogprob[],
  id: string,
  letrasValidas: string[],
): Record<string, number> | null {
  let acumulado = '';
  const alvo = new RegExp(`"${id}"\\s*:\\s*"$`);
  for (const tk of tokens) {
    if (alvo.test(acumulado)) {
      const candidatos = tk.top_logprobs?.length ? tk.top_logprobs : [{ token: tk.token, logprob: tk.logprob }];
      const dist: Record<string, number> = {};
      for (const c of candidatos) {
        const l = c.token.trim().replace(/"/g, '');
        if (letrasValidas.includes(l)) dist[l] = (dist[l] ?? 0) + Math.exp(c.logprob);
      }
      const soma = Object.values(dist).reduce((a, b) => a + b, 0);
      if (soma <= 0) return null;
      for (const k of Object.keys(dist)) dist[k]! /= soma;
      return dist;
    }
    acumulado += tk.token;
  }
  return null;
}

function validar(bruto: unknown, perguntas: Pergunta[]): Record<string, string> {
  if (!bruto || typeof bruto !== 'object') throw new ErroMotor('saida_invalida', 'saída não é objeto');
  const r: Record<string, string> = {};
  for (const p of perguntas) {
    const v = (bruto as Record<string, unknown>)[p.id];
    const valido = typeof v === 'string' && p.opcoes.some((_, i) => letra(i) === v.trim());
    if (!valido) throw new ErroMotor('saida_invalida', `resposta inválida para ${p.id}: ${String(v)}`);
    r[p.id] = (v as string).trim();
  }
  return r;
}

export class MotorLLM implements MotorDecisao {
  readonly nome: string;

  constructor(private readonly o: OpcoesMotorLLM) {
    this.nome = `llm:${o.modelo}:${o.metodo}`;
  }

  async decidir(r: { estado: string; perguntas: Pergunta[] }) {
    const inicio = Date.now();
    const { sistema, usuario } = montarPrompt(r.estado, r.perguntas, this.o.instrucoes);
    const pedido = {
      modelo: this.o.modelo,
      mensagens: [
        { role: 'system' as const, content: sistema },
        { role: 'user' as const, content: usuario },
      ],
      esquema: { nome: 'respostas', schema: esquemaRespostas(r.perguntas) },
      maxTokens: 40 + r.perguntas.length * 16,
      timeoutMs: this.o.timeoutMs ?? 8000,
    };

    let respostas: RespostaDecisao[];
    if (this.o.metodo === 'logprobs') {
      const resp = await this.o.cliente.chat({ ...pedido, temperatura: 0, logprobs: true, topLogprobs: 10 });
      if (!resp.logprobs) throw new ErroMotor('saida_invalida', 'o provedor não devolveu logprobs');
      const escolhas = validar(lerJson(resp.conteudo), r.perguntas);
      respostas = r.perguntas.map((p) => {
        const letras = p.opcoes.map((_, i) => letra(i));
        const dist = distribuicaoPorLogprobs(resp.logprobs!, p.id, letras);
        const escolhida = escolhas[p.id]!;
        return {
          id: p.id,
          escolha: p.opcoes[letras.indexOf(escolhida)]!,
          confianca: dist?.[escolhida] ?? 0.5,
          probs: dist ? Object.fromEntries(Object.entries(dist).map(([l, v]) => [p.opcoes[letras.indexOf(l)]!, v])) : undefined,
        };
      });
    } else {
      const n = Math.max(1, this.o.amostras ?? 3);
      const resultados = await Promise.allSettled(
        Array.from({ length: n }, (_, i) => this.o.cliente.chat({ ...pedido, temperatura: i === 0 ? 0 : 0.8 })),
      );
      const validas: Record<string, string>[] = [];
      for (const res of resultados) {
        if (res.status !== 'fulfilled') continue;
        try {
          validas.push(validar(lerJson(res.value.conteudo), r.perguntas));
        } catch {
          // amostra inválida conta como discordância
        }
      }
      if (validas.length === 0) {
        const erro = resultados.find((x) => x.status === 'rejected');
        if (erro && erro.status === 'rejected' && erro.reason instanceof ErroMotor) throw erro.reason;
        throw new ErroMotor('saida_invalida', 'nenhuma amostra válida');
      }
      respostas = r.perguntas.map((p) => {
        const contagem: Record<string, number> = {};
        for (const v of validas) contagem[v[p.id]!] = (contagem[v[p.id]!] ?? 0) + 1;
        // Empate: vale a amostra de temperatura 0 (a primeira válida).
        const ordenadas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        const max = ordenadas[0]![1];
        const empatadas = ordenadas.filter(([, c]) => c === max).map(([l]) => l);
        const escolhida = empatadas.includes(validas[0]![p.id]!) ? validas[0]![p.id]! : empatadas[0]!;
        const letras = p.opcoes.map((_, i) => letra(i));
        return {
          id: p.id,
          escolha: p.opcoes[letras.indexOf(escolhida)]!,
          // Amostras perdidas contam contra: confiança sobre n, não sobre as válidas.
          confianca: (contagem[escolhida] ?? 0) / n,
          probs: Object.fromEntries(Object.entries(contagem).map(([l, c]) => [p.opcoes[letras.indexOf(l)]!, c / n])),
        };
      });
    }
    return { respostas, motor: this.nome, latenciaMs: Date.now() - inicio };
  }
}
