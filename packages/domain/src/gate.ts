import type { AcaoGate, Gatilho, ResultadoRoteamento } from '@ramais/contracts';

export interface LimitesGate {
  encaminha: number;
  baixaCerteza: number;
  emergencia: number;
  gatilho: number;
}

/**
 * Gate de confiança do hotel. Errar o setor custa pouco e cada correção vira dado,
 * então a confiança média encaminha com a marca de baixa certeza em vez de perguntar.
 * Pergunta de volta só quando não há pedido acionável ("vago").
 */
export function aplicarGate(r: ResultadoRoteamento, limites: LimitesGate): { acao: AcaoGate; setor: string | null } {
  const setor = r.saida.setor;
  if (setor === 'vago') return { acao: 'perguntar', setor: null };
  if (setor === 'nenhum') return { acao: 'recepcao', setor: null };
  const c = r.confianca.setor;
  if (c >= limites.encaminha) return { acao: 'encaminhar', setor };
  if (c >= limites.baixaCerteza) return { acao: 'encaminhar_baixa_certeza', setor };
  return { acao: 'recepcao', setor: null };
}

/** Precedência fixa: emergência > encerrar > humano > setor errado > demora. */
export const PRECEDENCIA_GATILHOS: readonly Gatilho[] = [
  'emergencia',
  'quer_encerrar',
  'pede_humano',
  'setor_errado',
  'reclama_demora',
];

export interface PalavrasGlobais {
  encerrar: string[];
  humano: string[];
  emergencia: string[];
}

/** Minúsculas, sem acento, sem pontuação nas pontas, espaços colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras-chave exatas: a mensagem inteira é a palavra ("sair", "atendente"). */
export function gatilhoPorPalavra(texto: string, palavras: PalavrasGlobais): Gatilho | null {
  const t = normalizar(texto);
  if (!t) return null;
  if (palavras.emergencia.some((p) => t === normalizar(p))) return 'emergencia';
  if (palavras.encerrar.some((p) => t === normalizar(p))) return 'quer_encerrar';
  if (palavras.humano.some((p) => t === normalizar(p))) return 'pede_humano';
  return null;
}

/**
 * Escolhe o gatilho que vence, combinando palavra-chave (certeza total) e a saída do
 * roteador (cada gatilho com seu limite; emergência com limite baixo de propósito).
 */
export function gatilhoVencedor(
  porPalavra: Gatilho | null,
  r: ResultadoRoteamento | null,
  limites: LimitesGate,
): Gatilho | null {
  const ativos = new Set<Gatilho>();
  if (porPalavra) ativos.add(porPalavra);
  if (r) {
    for (const g of PRECEDENCIA_GATILHOS) {
      const limite = g === 'emergencia' ? limites.emergencia : limites.gatilho;
      // A confiança de um booleano é a confiança na resposta escolhida; só conta se a escolha for "sim".
      if (r.saida[g] && r.confianca[g] >= limite) ativos.add(g);
    }
  }
  return PRECEDENCIA_GATILHOS.find((g) => ativos.has(g)) ?? null;
}
