/** Só para desenvolvimento: apaga o banco inteiro. Depois rode setup e migrate. */
import pg from 'pg';
import { carregarEnv } from '../env.js';

carregarEnv();
const admin = process.env.DATABASE_URL_ADMIN;
const app = process.env.DATABASE_URL;
if (!admin || !app) throw new Error('defina DATABASE_URL_ADMIN e DATABASE_URL');
const host = new URL(app).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`reset recusado fora de localhost (${host})`);
const nome = new URL(app).pathname.slice(1);

const c = new pg.Client({ connectionString: admin });
await c.connect();
await c.query(`DROP DATABASE IF EXISTS ${nome.replace(/[^a-z0-9_]/g, '')} WITH (FORCE)`);
await c.end();
console.log(`banco "${nome}" apagado`);
