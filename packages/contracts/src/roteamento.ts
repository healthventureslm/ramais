import { z } from 'zod';
import { Urgencia } from './comum.js';

/** Saída estruturada da chamada de decisão, antes de calcular a confiança. */
export const SaidaRoteamento = z.object({
  /** id permitido, 'vago' (sem pedido acionável) ou 'nenhum' (nenhum setor serve). */
  setor: z.string(),
  urgencia: Urgencia,
  emergencia: z.boolean(),
  pede_humano: z.boolean(),
  quer_encerrar: z.boolean(),
  setor_errado: z.boolean(),
  reclama_demora: z.boolean(),
  insatisfeito: z.boolean(),
  idioma: z.string(),
});
export type SaidaRoteamento = z.infer<typeof SaidaRoteamento>;

export const GATILHOS = ['emergencia', 'quer_encerrar', 'pede_humano', 'setor_errado', 'reclama_demora'] as const;
export type Gatilho = (typeof GATILHOS)[number];

/** Resultado com confiança por pergunta (0..1). */
export interface ResultadoRoteamento {
  saida: SaidaRoteamento;
  confianca: {
    setor: number;
    urgencia: number;
    idioma: number;
  } & Record<Gatilho | 'insatisfeito', number>;
  /** Distribuição sobre setores, quando o motor fornece. */
  probsSetor?: Record<string, number>;
  motor: string;
  latenciaMs: number;
  metodoConfianca: 'nativa' | 'logprobs' | 'autoconsistencia' | 'regra';
}

export type AcaoGate = 'encaminhar' | 'encaminhar_baixa_certeza' | 'recepcao' | 'perguntar';
