import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';

function carregarDotenv(): void {
  let dir = resolve(process.cwd());
  for (;;) {
    const arquivo = join(dir, '.env');
    if (existsSync(arquivo)) {
      for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
        if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
      }
      return;
    }
    const pai = dirname(dir);
    if (pai === dir) return;
    dir = pai;
  }
}

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const vazioNulo = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

const Esquema = z.object({
  DATABASE_URL: z.string().url(),
  PORTA: z.coerce.number().int().default(3000),
  JWT_SEGREDO: z.string().min(32, 'JWT_SEGREDO precisa de 32+ caracteres'),
  WEB_ORIGEM: z.string().default('http://localhost:5173'),
  /** Endereço público do app web: o QR do chat do quarto aponta para <WEB_URL_PUBLICA>/q/<código>. */
  WEB_URL_PUBLICA: vazioNulo,
  POOL_MAX: z.coerce.number().int().default(10),
  /** Schema das filas do pg-boss. Os testes usam um próprio, isolado do worker de desenvolvimento. */
  PGBOSS_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('pgboss'),

  META_DRY_RUN: bool,
  META_APP_SECRET: z.string().min(1),
  META_VERIFY_TOKEN: z.string().min(1),
  META_TOKEN: vazioNulo,
  META_API_VERSAO: z.string().default('v23.0'),

  OPENROUTER_API_KEY: vazioNulo,
  IA_MODELO_ROTEAMENTO: z.string().default('typesafe/jev-1.13'),
  IA_MODELO_ROTEAMENTO_ALTERNATIVO: vazioNulo,
  IA_MODELO_TRADUCAO: z.string().default('google/gemini-3.1-flash-lite'),
  /** Reserva da tradução, usado quando o principal falha (limite do provedor, fora do ar). */
  IA_MODELO_TRADUCAO_ALTERNATIVO: vazioNulo,
  IA_MODELO_RESPOSTA: z.string().default('google/gemini-3.5-flash-lite'),
  IA_MODELO_MULTIMODAL: z.string().default('google/gemini-3.1-flash-lite'),
  IA_CONFIANCA: z.enum(['logprobs', 'autoconsistencia']).default('autoconsistencia'),
  IA_AMOSTRAS: z.coerce.number().int().min(1).max(7).default(3),
  IA_SEM_RETENCAO: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  /** Traduz a mensagem para inglês antes de rotear (comparar em sombra com o roteamento direto). */
  IA_PIVOT_INGLES: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),

  ARMAZENAMENTO: z.enum(['local', 's3']).default('local'),
  ARMAZENAMENTO_DIR: z.string().default('./armazenamento-local'),
  S3_BUCKET: vazioNulo,
  AWS_REGION: z.string().default('sa-east-1'),

  FCM_CONTA_SERVICO_B64: vazioNulo,

  /** Web Push (notificação no navegador). Sem as chaves, fica desligado. Gere com `pnpm --filter @ramais/api vapid`. */
  VAPID_PUBLICA: vazioNulo,
  VAPID_PRIVADA: vazioNulo,
  VAPID_CONTATO: z.string().default('mailto:contato@ramais.com.br'),
});

export type Config = z.infer<typeof Esquema>;

let cache: Config | null = null;

export function config(): Config {
  if (cache) return cache;
  carregarDotenv();
  const r = Esquema.safeParse(process.env);
  if (!r.success) {
    const erros = r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`configuração inválida:\n${erros}`);
  }
  if (r.data.ARMAZENAMENTO === 's3' && !r.data.S3_BUCKET) throw new Error('ARMAZENAMENTO=s3 exige S3_BUCKET');
  if (!r.data.META_DRY_RUN && !r.data.META_TOKEN) {
    console.warn('[config] META_DRY_RUN=false sem META_TOKEN: cada canal precisa da credencial em credencial_ref');
  }
  cache = r.data;
  return cache;
}
