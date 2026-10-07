/**
 * Cria os papéis e o banco. Roda uma vez por ambiente, com um superusuário
 * (DATABASE_URL_ADMIN). Em produção, as senhas vêm do gerenciador de segredos.
 */
import pg from 'pg';
import { carregarEnv } from '../env.js';

carregarEnv();

const admin = process.env.DATABASE_URL_ADMIN;
const appUrl = process.env.DATABASE_URL;
if (!admin || !appUrl) throw new Error('defina DATABASE_URL_ADMIN e DATABASE_URL');

const nomeBanco = new URL(appUrl).pathname.slice(1);
const senhaOwner = process.env.DB_SENHA_OWNER;
const senhaApp = process.env.DB_SENHA_APP;

function ident(s: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`identificador inválido: ${s}`);
  return s;
}

async function main() {
  const c = new pg.Client({ connectionString: admin });
  await c.connect();
  try {
    const existe = async (papel: string) =>
      (await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [papel])).rowCount! > 0;

    const criarPapel = async (papel: string, atributos: string, senha?: string) => {
      const comando = (await existe(papel)) ? 'ALTER' : 'CREATE';
      const pw = senha ? ` PASSWORD ${c.escapeLiteral(senha)}` : '';
      await c.query(`${comando} ROLE ${ident(papel)} ${atributos}${pw}`);
    };

    await criarPapel('ramais_owner', 'LOGIN NOSUPERUSER NOBYPASSRLS', senhaOwner);
    await criarPapel('ramais_app', 'LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', senhaApp);
    // Sem login. Só é dono das funções SECURITY DEFINER que olham entre organizações.
    await criarPapel('ramais_sistema', 'NOLOGIN NOSUPERUSER BYPASSRLS');
    // O dono precisa poder transferir a posse das funções SECURITY DEFINER.
    await c.query('GRANT ramais_sistema TO ramais_owner');

    const banco = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
    if (banco.rowCount === 0) {
      await c.query(`CREATE DATABASE ${ident(nomeBanco)} OWNER ramais_owner ENCODING 'UTF8'`);
    }
    console.log(`papéis e banco "${nomeBanco}" prontos`);
  } finally {
    await c.end();
  }

  // Dentro do banco: o app não cria nada no schema public.
  const url = new URL(admin);
  url.pathname = `/${nomeBanco}`;
  const d = new pg.Client({ connectionString: url.toString() });
  await d.connect();
  try {
    await d.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await d.query('GRANT USAGE, CREATE ON SCHEMA public TO ramais_owner');
    await d.query('GRANT USAGE ON SCHEMA public TO ramais_app');
    await d.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } finally {
    await d.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
