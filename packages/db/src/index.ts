import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export * as t from './schema.js';
export { FILAS, type NomeFila, type DadosTemporizador } from './filas.js';
export type { EstadoDb } from './schema.js';

export type Db = NodePgDatabase<typeof schema>;

/** O que uma transação com tenant oferece: Drizzle tipado e o client cru (para pg-boss e SQL livre). */
export interface Tx {
  db: Db;
  client: pg.PoolClient;
  orgId: string;
  /** Adaptador para enfileirar jobs do pg-boss na mesma transação (`{ db: tx.boss }`). */
  boss: { executeSql(text: string, values?: unknown[]): Promise<{ rows: any[] }> };
}

export function criarPool(connectionString: string, max = 10): pg.Pool {
  const pool = new pg.Pool({ connectionString, max, application_name: 'ramais' });
  pool.on('error', (e) => console.error('[pg] erro em conexão ociosa', e));
  return pool;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre uma transação com o tenant definido. É a ÚNICA forma de tocar tabelas de negócio.
 * `set_config(..., true)` vale só para esta transação: o valor não sobrevive no pool.
 */
export async function comTenant<T>(pool: pg.Pool, orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(orgId)) throw new Error('orgId inválido');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    const db = drizzle(client, { schema });
    const tx: Tx = {
      db,
      client,
      orgId,
      boss: { executeSql: (text, values) => client.query(text, values as unknown[]) },
    };
    const r = await fn(tx);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Lock consultivo por chave, liberado no fim da transação. */
export async function travar(tx: Tx, chave: string): Promise<void> {
  await tx.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [chave]);
}

// ---------- Funções entre organizações (SECURITY DEFINER) ----------

export async function resolverCanal(pool: pg.Pool, phoneNumberId: string) {
  const r = await pool.query<{ org_id: string; unidade_id: string; canal_id: string }>(
    'SELECT * FROM sistema.resolver_canal($1)',
    [phoneNumberId],
  );
  const l = r.rows[0];
  return l ? { orgId: l.org_id, unidadeId: l.unidade_id, canalId: l.canal_id } : null;
}

export async function resolverLogin(pool: pg.Pool, email: string) {
  const r = await pool.query<{ org_id: string; pessoa_id: string }>('SELECT * FROM sistema.resolver_login($1)', [email]);
  const l = r.rows[0];
  return l ? { orgId: l.org_id, pessoaId: l.pessoa_id } : null;
}

export async function resolverCodigoDispositivo(pool: pg.Pool, hash: string) {
  const r = await pool.query<{ org_id: string; unidade_id: string; dispositivo_id: string }>(
    'SELECT * FROM sistema.resolver_codigo_dispositivo($1)',
    [hash],
  );
  const l = r.rows[0];
  return l ? { orgId: l.org_id, unidadeId: l.unidade_id, dispositivoId: l.dispositivo_id } : null;
}

/** QR do quarto lido sem login: o código diz o org, a unidade e o quarto. */
export async function resolverQuarto(pool: pg.Pool, codigo: string) {
  const r = await pool.query<{ org_id: string; unidade_id: string; local_id: string }>('SELECT * FROM sistema.resolver_quarto($1)', [codigo]);
  const l = r.rows[0];
  return l ? { orgId: l.org_id, unidadeId: l.unidade_id, localId: l.local_id } : null;
}

/** Sessão do chat do quarto: o hash do segredo do navegador diz o org e a sessão (se não expirou). */
export async function resolverChat(pool: pg.Pool, tokenHash: string) {
  const r = await pool.query<{ org_id: string; sessao_id: string }>('SELECT * FROM sistema.resolver_chat($1)', [tokenHash]);
  const l = r.rows[0];
  return l ? { orgId: l.org_id, sessaoId: l.sessao_id } : null;
}

export async function pendenciasVarredura(pool: pg.Pool, folgaSeg = 30) {
  const r = await pool.query<{ org_id: string; tipo: string; ref_id: string }>(
    'SELECT * FROM sistema.pendencias_varredura($1)',
    [folgaSeg],
  );
  return r.rows.map((l) => ({
    orgId: l.org_id,
    tipo: l.tipo as 'oferta_vencida' | 'setor_com_fila' | 'presenca_inativa' | 'escada',
    refId: l.ref_id,
  }));
}
export { carregarEnv } from './env.js';
export { instalarFilas } from './instalar-filas.js';
