import { z } from 'zod';

/**
 * Escada de escalonamento: o que acontece enquanto o solicitante espera a equipe.
 *
 * A espera começa quando o pedido entra na fila de um setor, ou quando o hóspede escreve
 * e a conversa já tem responsável. Termina quando alguém da equipe responde (no pedido
 * interno, quando alguém aceita). Passar para outra pessoa do mesmo setor não zera a espera.
 */

export const AlvoAviso = z.discriminatedUnion('tipo', [
  /** Supervisores de um setor. Sem setor: o setor do pedido. */
  z.object({ tipo: z.literal('supervisores'), setor: z.string().optional() }),
  /** Todo mundo no turno de um setor (ex.: Recepção). */
  z.object({ tipo: z.literal('turno'), setor: z.string() }),
  /** Uma pessoa (ex.: gerente de plantão). O nome é só para exibir. */
  z.object({ tipo: z.literal('pessoa'), pessoaId: z.uuid(), nome: z.string().optional() }),
  /** Todos os gerentes da organização. */
  z.object({ tipo: z.literal('gerentes') }),
]);
export type AlvoAviso = z.infer<typeof AlvoAviso>;

export const DegrauAviso = z.object({
  /** Minutos de espera, contados do início da espera. */
  aposMin: z.number().positive().max(24 * 60),
  alvo: AlvoAviso,
  /** Avisa mesmo quem está fora do turno (no celular em que a pessoa entrou por último). */
  foraDoTurno: z.boolean().default(false),
});
export type DegrauAviso = z.infer<typeof DegrauAviso>;

export const Escada = z.object({
  /** Cada oferta dura isto; sem aceite, vai para outra pessoa do setor. */
  ofertaSegundos: z.number().int().min(10).max(3600).default(60),
  /** Aceitou e não respondeu o hóspede: lembra o responsável (0 = não lembra). */
  lembrarMin: z.number().min(0).max(240).default(2),
  /** Aceitou e não respondeu: passa para outra pessoa do setor (0 = nunca). Conta do aceite. */
  repassarMin: z.number().min(0).max(240).default(5),
  /** Avisos em ordem, enquanto o solicitante espera. */
  avisos: z.array(DegrauAviso).max(10).default([{ aposMin: 3, alvo: { tipo: 'supervisores' }, foraDoTurno: false }]),
  /** Aviso honesto ao hóspede de que está demorando (0 = não avisa). Uma vez por espera. */
  avisoSolicitanteMin: z.number().min(0).max(240).default(8),
});
export type Escada = z.infer<typeof Escada>;
export type EscadaEntrada = z.input<typeof Escada>;
