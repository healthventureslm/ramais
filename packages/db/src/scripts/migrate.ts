/**
 * Aplica as migrações SQL em ordem, cada uma numa transação, e instala o schema do pg-boss.
 * Roda como ramais_owner.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { instalarFilas } from '../instalar-filas.js';
import { carregarEnv } from '../env.js';

carregarEnv();

const url = process.env.DATABASE_URL_OWNER;
if (!url) throw new Error('defina DATABASE_URL_OWNER');

const pasta = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

async function main() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('CREATE SCHEMA IF NOT EXISTS sistema');
    await c.query(`CREATE TABLE IF NOT EXISTS sistema.migracoes (
      nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`);
    const feitas = new Set((await c.query('SELECT nome FROM sistema.migracoes')).rows.map((r) => r.nome as string));
    const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
    for (const arquivo of arquivos) {
      if (feitas.has(arquivo)) continue;
      const sql = readFileSync(join(pasta, arquivo), 'utf8');
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO sistema.migracoes (nome) VALUES ($1)', [arquivo]);
        await c.query('COMMIT');
        console.log(`aplicada: ${arquivo}`);
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`falha em ${arquivo}: ${(e as Error).message}`);
      }
    }
  } finally {
    await c.end();
  }

  // pg-boss instala e migra o próprio schema; a aplicação roda com migrate: false.
  await instalarFilas(url!);
  console.log('pg-boss pronto');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
