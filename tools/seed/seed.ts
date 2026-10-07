/**
 * Popula o banco local com uma rede, um hotel piloto, setores, equipe, quartos com QR,
 * hóspedes ativos e base de conhecimento. Roda como ramais_owner (sujeito a RLS: cada
 * escrita define o tenant). Idempotente: se o canal de dev já existe, não faz nada.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { carregarEnv, comTenant, criarPool } from '@ramais/db';
import { gerarCodigoLocal, linkWhatsApp } from '@ramais/domain';
import { configHotel, conhecimentoHotelExemplo } from '@ramais/vertical-hotel';

import { CANAL_DEV, HOSPEDES, PESSOAS, PIN_DEV, QUARTOS, SENHA_DEV } from './dados.js';

carregarEnv();
const url = process.env.DATABASE_URL_OWNER;
if (!url) throw new Error('defina DATABASE_URL_OWNER');

const pool = criarPool(url, 2);
const aleatorio = (n: number) => new Uint8Array(randomBytes(n));

// Como dono, sem tenant, a RLS esconde tudo: a checagem de idempotência usa a função de sistema.
const ja = await pool.query('SELECT * FROM sistema.resolver_canal($1)', [CANAL_DEV.phoneNumberId]);
if (ja.rows.length) {
  console.log('seed já aplicado (canal de dev existe). Use `pnpm db:reset` para recomeçar.');
  await pool.end();
  process.exit(0);
}

const orgId = randomUUID();
const hoje = new Date();
const dia = (d: number) => new Date(hoje.getTime() + d * 86_400_000).toISOString().slice(0, 10);

const saida = await comTenant(pool, orgId, async ({ client }) => {
  await client.query('INSERT INTO organizacao (id, nome) VALUES ($1, $2)', [orgId, 'Rede Piloto']);
  const u = await client.query<{ id: string }>('INSERT INTO unidade (org_id, nome) VALUES ($1, $2) RETURNING id', [
    orgId,
    'Hotel Piloto Copacabana',
  ]);
  const unidadeId = u.rows[0]!.id;

  const j = await client.query<{ id: string }>(
    'INSERT INTO jornada_versao (org_id, unidade_id, numero, config) VALUES ($1, $2, 1, $3) RETURNING id',
    [orgId, unidadeId, JSON.stringify(configHotel)],
  );
  await client.query('UPDATE unidade SET jornada_versao_id = $2 WHERE id = $1', [unidadeId, j.rows[0]!.id]);

  await client.query(
    `INSERT INTO canal_whatsapp (org_id, unidade_id, phone_number_id, waba_id, numero_exibicao, modo_credencial, credencial_ref)
     VALUES ($1, $2, $3, $4, $5, 'propria', 'META_TOKEN')`,
    [orgId, unidadeId, CANAL_DEV.phoneNumberId, CANAL_DEV.wabaId, CANAL_DEV.numero],
  );

  const setores = new Map<string, string>();
  for (const s of configHotel.setores) {
    const r = await client.query<{ id: string }>(
      'INSERT INTO setor (org_id, unidade_id, chave, nome) VALUES ($1, $2, $3, $4) RETURNING id',
      [orgId, unidadeId, s.chave, s.nome],
    );
    setores.set(s.chave, r.rows[0]!.id);
  }

  const senha = await bcrypt.hash(SENHA_DEV, 10);
  const pin = await bcrypt.hash(PIN_DEV, 10);
  for (const p of PESSOAS) {
    const r = await client.query<{ id: string }>(
      'INSERT INTO pessoa (org_id, nome, email, senha_hash, pin_hash, idiomas, admin) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [orgId, p.nome, p.email, senha, pin, p.idiomas ?? ['pt'], p.admin ?? false],
    );
    for (const l of p.lotacoes) {
      await client.query(
        'INSERT INTO lotacao (org_id, pessoa_id, setor_id, papel, recebe) VALUES ($1, $2, $3, $4, $5)',
        [orgId, r.rows[0]!.id, setores.get(l.setor), l.papel ?? 'membro', l.recebe ?? 'sempre'],
      );
    }
  }

  const locais: { quarto: string; codigo: string; link: string }[] = [];
  const idPorQuarto = new Map<string, string>();
  for (const q of QUARTOS) {
    const codigo = gerarCodigoLocal(aleatorio);
    const r = await client.query<{ id: string }>(
      `INSERT INTO local (org_id, unidade_id, tipo, identificador, codigo_qr) VALUES ($1, $2, 'quarto', $3, $4) RETURNING id`,
      [orgId, unidadeId, q, codigo],
    );
    idPorQuarto.set(q, r.rows[0]!.id);
    locais.push({ quarto: q, codigo, link: linkWhatsApp(CANAL_DEV.numero, codigo, 'Olá! Preciso de ajuda.') });
  }

  for (const h of HOSPEDES) {
    await client.query(
      'INSERT INTO hospede_ativo (org_id, unidade_id, local_id, sobrenome, checkin, checkout) VALUES ($1, $2, $3, $4, $5, $6)',
      [orgId, unidadeId, idPorQuarto.get(h.quarto), h.sobrenome, dia(-1), dia(3)],
    );
  }

  for (const k of conhecimentoHotelExemplo) {
    await client.query(
      'INSERT INTO base_conhecimento (org_id, unidade_id, chave, pergunta, resposta, tags) VALUES ($1, $2, $3, $4, $5, $6)',
      [orgId, unidadeId, k.id, k.pergunta, k.resposta, k.tags],
    );
  }

  // Um celular de setor já com código de cadastro, para testar o app.
  const codigoDispositivo = randomBytes(9).toString('base64url');
  await client.query(
    `INSERT INTO dispositivo (org_id, unidade_id, nome, codigo_cadastro_hash, codigo_expira_em)
     VALUES ($1, $2, 'Celular Governança', $3, now() + interval '7 days')`,
    [orgId, unidadeId, createHash('sha256').update(codigoDispositivo).digest('hex')],
  );

  return { orgId, unidadeId, setores: Object.fromEntries(setores), locais, codigoDispositivo };
});

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
mkdirSync(join(raiz, '.dev'), { recursive: true });
writeFileSync(join(raiz, '.dev', 'seed.json'), JSON.stringify({ ...saida, canal: CANAL_DEV }, null, 2));

console.log(`seed aplicado: ${PESSOAS.length} pessoas, ${QUARTOS.length} quartos, ${HOSPEDES.length} hóspedes`);
console.log('credenciais de dev: veja tools/seed/dados.ts');
console.log('ids, QR dos quartos e código de cadastro do celular: .dev/seed.json');
await pool.end();
