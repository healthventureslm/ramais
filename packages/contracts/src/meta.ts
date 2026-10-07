import { z } from 'zod';

/** Recorte do payload de webhook da WhatsApp Cloud API que o sistema usa. */

const MidiaMeta = z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() });

export const MensagemMeta = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: MidiaMeta.optional(),
  audio: MidiaMeta.extend({ voice: z.boolean().optional() }).optional(),
  document: MidiaMeta.extend({ filename: z.string().optional() }).optional(),
  button: z.object({ text: z.string() }).optional(),
  interactive: z.unknown().optional(),
});
export type MensagemMeta = z.infer<typeof MensagemMeta>;

export const StatusMeta = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(z.object({ code: z.number(), title: z.string().optional() })).optional(),
});
export type StatusMeta = z.infer<typeof StatusMeta>;

export const ValorMeta = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({ display_phone_number: z.string(), phone_number_id: z.string() }),
  contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() })).optional(),
  messages: z.array(MensagemMeta).optional(),
  statuses: z.array(StatusMeta).optional(),
});
export type ValorMeta = z.infer<typeof ValorMeta>;

export const WebhookMeta = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(z.object({ field: z.string(), value: z.unknown() })),
    }),
  ),
});
export type WebhookMeta = z.infer<typeof WebhookMeta>;
