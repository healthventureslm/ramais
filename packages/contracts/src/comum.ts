import { z } from 'zod';

export const IDIOMAS_FIXOS = ['pt', 'es', 'en'] as const;
export const IdiomaFixo = z.enum(IDIOMAS_FIXOS);
export type IdiomaFixo = z.infer<typeof IdiomaFixo>;

/** Código ISO 639-1 (pt, es, en, fr...). Mensagens livres aceitam qualquer idioma. */
export const Idioma = z.string().min(2).max(8);
export type Idioma = z.infer<typeof Idioma>;

export const Urgencia = z.enum(['rotina', 'hoje', 'agora']);
export type Urgencia = z.infer<typeof Urgencia>;

export const URGENCIA_PESO: Record<Urgencia, number> = { agora: 3, hoje: 2, rotina: 1 };

export const EstadoSolicitacao = z.enum([
  'automacao',
  'na_fila',
  'oferecida',
  'em_atendimento',
  'aguardando_solicitante',
  'resolvida',
  'encerrada',
  'cancelada',
]);
export type EstadoSolicitacao = z.infer<typeof EstadoSolicitacao>;

export const ESTADOS_ABERTOS: readonly EstadoSolicitacao[] = [
  'automacao',
  'na_fila',
  'oferecida',
  'em_atendimento',
  'aguardando_solicitante',
];

export const Visibilidade = z.enum(['externa', 'interna']);
export type Visibilidade = z.infer<typeof Visibilidade>;

export const TipoMidia = z.enum(['texto', 'imagem', 'audio', 'documento']);
export type TipoMidia = z.infer<typeof TipoMidia>;

export const Recebe = z.enum(['sempre', 'ultimo_recurso', 'nunca']);
export type Recebe = z.infer<typeof Recebe>;

export const PapelLotacao = z.enum(['membro', 'supervisor']);
export type PapelLotacao = z.infer<typeof PapelLotacao>;

/** Textos traduzidos para os idiomas fixos. */
export const TextoI18n = z.object({ pt: z.string(), es: z.string(), en: z.string() });
export type TextoI18n = z.infer<typeof TextoI18n>;
