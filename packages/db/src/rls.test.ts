/**
 * Testes de isolamento entre organizações. Precisam do banco local
 * (`pnpm db:setup && pnpm db:migrate`); sem DATABASE_URL são pulados.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { carregarEnv } from './env.js';
import { comTenant, criarPool, resolverCanal } from './index.js';

carregarEnv();
const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_URL_OWNER;
const temBanco = Boolean(appUrl && ownerUrl);

describe.skipIf(!temBanco)('RLS', () => {
  let app: pg.Pool;
  let owner: pg.Pool;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const phoneB = `teste-${randomUUID()}`;

  async function criarOrg(org: string, nome: string, phone: string) {
    await comTenant(owner, org, async ({ client }) => {
      await client.query('INSERT INTO organizacao (id, nome) VALUES ($1, $2)', [org, nome]);
      const u = await client.query('INSERT INTO unidade (org_id, nome) VALUES ($1, $2) RETURNING id', [org, `${nome} Unidade`]);
      const unidadeId = u.rows[0].id;
      await client.query(
        `INSERT INTO canal_whatsapp (org_id, unidade_id, phone_number_id, waba_id, numero_exibicao, modo_credencial, credencial_ref)
         VALUES ($1, $2, $3, 'waba', '+55', 'propria', 'ref')`,
        [org, unidadeId, phone],
      );
      await client.query('INSERT INTO pessoa (org_id, nome, email) VALUES ($1, $2, $3)', [
        org,
        `Pessoa ${nome}`,
        `${randomUUID()}@teste.dev`,
      ]);
      await client.query("INSERT INTO evento (org_id, tipo, ator_tipo) VALUES ($1, 'teste', 'sistema')", [org]);
    });
  }

  beforeAll(async () => {
    app = criarPool(appUrl!, 2);
    owner = criarPool(ownerUrl!, 2);
    await criarOrg(orgA, 'A', `teste-${randomUUID()}`);
    await criarOrg(orgB, 'B', phoneB);
  });

  afterAll(async () => {
    await app?.end();
    await owner?.end();
  });

  it('o papel da aplicação não é dono nem ignora RLS', async () => {
    const r = await app.query(
      `SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`,
    );
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
    const donas = await app.query(
      `SELECT count(*)::int AS n FROM pg_tables WHERE tableowner = current_user`,
    );
    expect(donas.rows[0].n).toBe(0);
  });

  it('toda tabela com org_id tem RLS ligada e forçada', async () => {
    const r = await app.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped)`);
    expect(r.rows.length).toBeGreaterThan(20);
    for (const l of r.rows) {
      expect({ tabela: l.relname, rls: l.relrowsecurity, force: l.relforcerowsecurity }).toEqual({
        tabela: l.relname,
        rls: true,
        force: true,
      });
    }
  });

  it('sem tenant definido, nenhuma linha aparece (falha fechada)', async () => {
    const r = await app.query('SELECT count(*)::int AS n FROM pessoa');
    expect(r.rows[0].n).toBe(0);
  });

  it('com tenant A, só vê dados de A', async () => {
    const orgs = await comTenant(app, orgA, async ({ client }) => {
      const r = await client.query('SELECT DISTINCT org_id FROM pessoa UNION SELECT DISTINCT org_id FROM unidade');
      return r.rows.map((l) => l.org_id);
    });
    expect(orgs).toEqual([orgA]);
  });

  it('não grava linha de outra organização', async () => {
    await expect(
      comTenant(app, orgA, ({ client }) =>
        client.query('INSERT INTO pessoa (org_id, nome, email) VALUES ($1, $2, $3)', [orgB, 'invasor', `${randomUUID()}@x.dev`]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('não move linha para outra organização', async () => {
    await expect(
      comTenant(app, orgA, ({ client }) => client.query('UPDATE pessoa SET org_id = $1', [orgB])),
    ).rejects.toThrow(/row-level security/);
  });

  it('o tenant não vaza para a próxima transação do pool', async () => {
    await comTenant(app, orgA, async () => undefined);
    const r = await app.query("SELECT current_setting('app.org_id', true) AS v");
    expect(r.rows[0].v ?? '').toBe('');
  });

  it('resolver_canal acha a organização pelo número, entre tenants', async () => {
    const c = await resolverCanal(app, phoneB);
    expect(c?.orgId).toBe(orgB);
  });

  it('o log de eventos é imutável', async () => {
    await expect(
      comTenant(app, orgA, ({ client }) => client.query("UPDATE evento SET tipo = 'x'")),
    ).rejects.toThrow();
  });
});
