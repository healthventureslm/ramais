import { ErroMotor, type MotorDecisao, type Pergunta, type RespostaDecisao as RespostaMotor } from '@ramais/contracts';
import type { ClienteDecisoes, PerguntaDecisao } from './openrouter.js';

/**
 * Motor sobre um modelo de decisão (Jev, da TypeSafe) pela Decisions API do OpenRouter.
 * Em vez de gerar texto, responde perguntas tipadas com a probabilidade de cada opção:
 * a confiança é nativa, sem várias amostras nem logprobs.
 *
 *   escolha  → `choice`  (confiança = `confidence` do modelo, ou a probabilidade da opção)
 *   sim/não  → `noul`    (probabilidade de "sim")
 */
export interface OpcoesMotorJev {
  cliente: ClienteDecisoes;
  modelo: string;
  timeoutMs?: number;
}

function paraPergunta(p: Pergunta): PerguntaDecisao {
  if (p.tipo === 'sim_nao') {
    return {
      type: 'noul',
      instructions: p.texto.replace(/\s*\(nao = no, sim = yes\)$/, ''),
      criteria: p.descricoes?.sim && p.descricoes.nao ? { true: p.descricoes.sim, false: p.descricoes.nao } : undefined,
    };
  }
  return {
    type: 'choice',
    instructions: p.texto,
    criteria: Object.fromEntries(p.opcoes.map((o) => [o, p.descricoes?.[o] ?? o])),
  };
}

export class MotorJev implements MotorDecisao {
  readonly nome: string;

  constructor(private readonly o: OpcoesMotorJev) {
    // O sufixo ':nativa' marca o método de confiança no registro da decisão.
    this.nome = `jev:${o.modelo}:nativa`;
  }

  async decidir(r: { estado: string; perguntas: Pergunta[] }) {
    const inicio = Date.now();
    // O catálogo já vai nos critérios de cada opção: o estado leva só fatos, histórico e mensagem.
    const estado = r.estado.startsWith('Departments') ? r.estado.split('\n\n').slice(1).join('\n\n') : r.estado;
    const res = await this.o.cliente.decisoes({
      modelo: this.o.modelo,
      estado,
      perguntas: Object.fromEntries(r.perguntas.map((p) => [p.id, paraPergunta(p)])),
      timeoutMs: this.o.timeoutMs ?? 6000,
    });
    const respostas: RespostaMotor[] = r.perguntas.map((p) => {
      const a = res.respostas[p.id];
      if (!a) throw new ErroMotor('saida_invalida', `sem resposta para ${p.id}`);
      if (a.type === 'noul') {
        const sim = Math.min(1, Math.max(0, a.noul));
        const escolha = sim >= 0.5 ? 'sim' : 'nao';
        return { id: p.id, escolha, confianca: escolha === 'sim' ? sim : 1 - sim, probs: { sim, nao: 1 - sim } };
      }
      // Nunca aceita uma opção que não estava entre as permitidas.
      if (!p.opcoes.includes(a.choice)) throw new ErroMotor('saida_invalida', `opção fora da lista em ${p.id}: ${a.choice}`);
      const prob = a.probabilities?.[a.choice];
      return { id: p.id, escolha: a.choice, confianca: a.confidence ?? prob ?? 0.5, probs: a.probabilities };
    });
    return { respostas, motor: this.nome, latenciaMs: Date.now() - inicio };
  }
}

/** Modelos de decisão vão pela Decisions API; os demais, por chat completions. */
export function ehModeloDeDecisao(modelo: string): boolean {
  return /^~?typesafe\/jev-(?!router)/.test(modelo);
}
