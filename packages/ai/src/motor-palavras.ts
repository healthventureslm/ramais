import type { MotorDecisao, Pergunta, RespostaDecisao, SetorCatalogo } from '@ramais/contracts';
import { normalizar } from '@ramais/domain';
import { detectarIdioma } from './idioma.js';

/**
 * Motor de regras por palavra-chave do catálogo. É o último degrau da cadeia:
 * funciona sem IA, sem rede e sem custo. A confiança é fixa e baixa de propósito,
 * para que o gate marque "baixa certeza" ou mande à recepção.
 */

const SAUDACOES = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hola', 'buenos dias', 'buenas tardes',
  'buenas noches', 'hi', 'hello', 'hey', 'good morning', 'good evening', 'preciso de ajuda', 'ajuda', 'ayuda',
  'help', 'necesito ayuda', 'i need help', 'tudo bem', 'oi tudo bem'];

const FLAGS: Record<string, string[]> = {
  emergencia: ['emergencia', 'socorro', 'incendio', 'fogo', 'fumaca', 'desmaio', 'desmaiou', 'sangue', 'sangrando',
    'infarto', 'ambulancia', 'samu', 'fire', 'smoke', 'emergency', 'bleeding', 'fainted', 'ambulance', 'heart attack',
    'humo', 'sangre', 'desmayo', 'urgencia medica', 'nao respira', 'not breathing', 'no respira'],
  pede_humano: ['falar com atendente', 'falar com uma pessoa', 'falar com alguem', 'quero um humano', 'atendente humano',
    'talk to a person', 'speak to someone', 'real person', 'human agent', 'hablar con una persona', 'hablar con alguien'],
  quer_encerrar: ['pode encerrar', 'era so isso', 'nao preciso mais', 'resolvido obrigado', 'ja resolveu',
    'that is all', 'no longer need', 'you can close', 'eso es todo', 'ya no necesito', 'puede cerrar'],
  setor_errado: ['setor errado', 'nao e isso', 'nao foi isso que pedi', 'pessoa errada', 'wrong department',
    'not what i asked', 'departamento equivocado', 'no es eso'],
  reclama_demora: ['demora', 'demorando', 'ainda nada', 'ninguem veio', 'esperando ha', 'estou esperando', 'ate agora nada',
    'taking long', 'still waiting', 'nobody came', 'been waiting', 'tardando', 'nadie vino', 'sigo esperando'],
  insatisfeito: ['pessimo', 'horrivel', 'absurdo', 'descaso', 'reclamacao', 'terrible', 'awful', 'unacceptable',
    'complaint', 'pesimo', 'horrible', 'inaceptable', 'queja'],
};

const URGENTE = ['urgente', 'agora', 'imediato', 'rapido', 'urgent', 'asap', 'right now', 'immediately', 'ahora', 'inmediato'];
const HOJE = ['hoje', 'hoje a noite', 'mais tarde', 'today', 'tonight', 'later', 'hoy', 'esta noche', 'mas tarde'];

/** Termo de uma palavra aceita plural/flexão curta ("toalla" ↔ "toallas"); frase exige a frase. */
function contem(t: string, termo: string): boolean {
  const n = normalizar(termo);
  if (!n) return false;
  if (n.includes(' ')) return ` ${t} `.includes(` ${n} `);
  return t.split(' ').some((p) => p === n || (n.length >= 4 && p.startsWith(n) && p.length - n.length <= 2));
}

export class MotorPalavras implements MotorDecisao {
  readonly nome = 'regras:palavras-chave';

  constructor(private readonly setores: Pick<SetorCatalogo, 'chave' | 'palavrasChave'>[]) {}

  async decidir(r: { estado: string; perguntas: Pergunta[] }) {
    const inicio = Date.now();
    // O estado traz a mensagem original numa linha "Message: ..."; o resto é catálogo.
    const msg = /^Message(?: \(original\))?: (.*)$/m.exec(r.estado)?.[1] ?? r.estado;
    const t = normalizar(msg);
    const respostas: RespostaDecisao[] = r.perguntas.map((p) => {
      if (p.id === 'setor') return this.setor(t, p);
      if (p.id === 'urgencia') {
        const v = URGENTE.some((u) => contem(t, u)) ? 'agora' : HOJE.some((u) => contem(t, u)) ? 'hoje' : 'rotina';
        return { id: p.id, escolha: p.opcoes.includes(v) ? v : p.opcoes[0]!, confianca: 0.6 };
      }
      if (p.id === 'idioma') {
        const d = detectarIdioma(msg);
        const v = p.opcoes.includes(d.idioma) ? d.idioma : (p.opcoes.at(-1) ?? 'outro');
        return { id: p.id, escolha: v, confianca: d.confianca };
      }
      const termos = FLAGS[p.id];
      if (termos) {
        const sim = termos.some((x) => contem(t, x));
        return { id: p.id, escolha: sim ? 'sim' : 'nao', confianca: sim ? 0.8 : 0.7 };
      }
      return { id: p.id, escolha: p.opcoes[0]!, confianca: 0.3 };
    });
    return { respostas, motor: this.nome, latenciaMs: Date.now() - inicio };
  }

  private setor(t: string, p: Pergunta): RespostaDecisao {
    const pontos = new Map<string, number>();
    for (const s of this.setores) {
      if (!p.opcoes.includes(s.chave)) continue;
      let pts = 0;
      for (const k of s.palavrasChave) if (contem(t, k)) pts += normalizar(k).split(' ').length;
      if (pts > 0) pontos.set(s.chave, pts);
    }
    const ordenados = [...pontos.entries()].sort((a, b) => b[1] - a[1]);
    const total = ordenados.reduce((a, [, v]) => a + v, 0);
    const probs = Object.fromEntries(ordenados.map(([k, v]) => [k, v / Math.max(total, 1)]));
    if (ordenados.length === 0) {
      const palavras = t.split(' ').filter(Boolean).length;
      const saudacao = palavras <= 4 && SAUDACOES.some((s) => t === normalizar(s) || t.startsWith(`${normalizar(s)} `));
      if ((saudacao || palavras <= 1) && p.opcoes.includes('vago')) return { id: 'setor', escolha: 'vago', confianca: 0.9 };
      return { id: 'setor', escolha: p.opcoes.includes('nenhum') ? 'nenhum' : p.opcoes[0]!, confianca: 0.5 };
    }
    const [primeiro, segundo] = ordenados;
    // Vencedor isolado: baixa certeza (0,7). Empate ou disputa: recepção (0,4).
    const confianca = !segundo ? 0.7 : primeiro![1] >= 2 * segundo[1] ? 0.65 : 0.4;
    return { id: 'setor', escolha: primeiro![0], confianca, probs };
  }
}
