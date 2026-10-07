/**
 * Cria o hotel de demonstração (demo-dados.ts) numa organização própria, separada do Hotel
 * Piloto: unidade, setores, logins (admin, gerente e um por setor), quartos com QR para o chat
 * do quarto, hóspedes em casa e base de conhecimento.
 *
 * Todos os logins usam a mesma senha, DEMO_SENHA (6+ caracteres): é para apresentação. Troque
 * ou desative as contas antes de o hotel usar de verdade.
 *
 * Idempotente: se o login do admin já existe, não faz nada. Em produção roda no contêiner de
 * migração quando DEMO_SENHA está definida (docker-compose.api.yml).
 *   DEMO_SENHA=... pnpm --filter @ramais/seed demo
 */
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { carregarEnv, comTenant, criarPool } from '@ramais/db';
import { gerarCodigoLocal } from '@ramais/domain';
import { configHotel } from '@ramais/vertical-hotel';

import { DEMO, DEMO_CONHECIMENTO, DEMO_HOSPEDES, DEMO_PESSOAS, DEMO_QUARTOS } from './demo-dados.js';

carregarEnv();
const url = process.env.DATABASE_URL_OWNER;
if (!url) throw new Error('defina DATABASE_URL_OWNER');
const senhaDemo = process.env.DEMO_SENHA ?? '';
if (senhaDemo.length < 6) throw new Error('defina DEMO_SENHA com 6 ou mais caracteres');

const email = (usuario: string) => `${usuario}@${DEMO.dominioEmail}`;
const pool = criarPool(url, 2);
const aleatorio = (n: number) => new Uint8Array(randomBytes(n));

// Como dono, sem tenant, a RLS esconde tudo: a checagem usa a função de sistema do login.
const ja = await pool.query('SELECT * FROM sistema.resolver_login($1)', [email('admin')]);
if (ja.rows.length) {
  console.log(`demo já existe (${DEMO.unidade}, login ${email('admin')}). Nada alterado.`);
  await pool.end();
  process.exit(0);
}

const orgId = randomUUID();
const hoje = new Date();
const dia = (d: number) => new Date(hoje.getTime() + d * 86_400_000).toISOString().slice(0, 10);

await comTenant(pool, orgId, async ({ client }) => {
  await client.query('INSERT INTO organizacao (id, nome) VALUES ($1, $2)', [orgId, DEMO.organizacao]);
  // QR para o chat do quarto: funciona sem número de WhatsApp (o canal web nasce no 1º acesso).
  const u = await client.query<{ id: string }>(
    `INSERT INTO unidade (org_id, nome, qr_destino) VALUES ($1, $2, 'web') RETURNING id`,
    [orgId, DEMO.unidade],
  );
  const unidadeId = u.rows[0]!.id;

  const j = await client.query<{ id: string }>(
    'INSERT INTO jornada_versao (org_id, unidade_id, numero, config) VALUES ($1, $2, 1, $3) RETURNING id',
    [orgId, unidadeId, JSON.stringify(configHotel)],
  );
  await client.query('UPDATE unidade SET jornada_versao_id = $2 WHERE id = $1', [unidadeId, j.rows[0]!.id]);

  // IA em modo automático: na apresentação o pedido cai direto no setor certo, em vez de ficar
  // na recepção com a sugestão (o padrão, "sombra"). Volta pela tela de administração.
  const setores = new Map<string, string>();
  for (const s of configHotel.setores) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO setor (org_id, unidade_id, chave, nome, modo_ia) VALUES ($1, $2, $3, $4, 'automatico') RETURNING id`,
      [orgId, unidadeId, s.chave, s.nome],
    );
    setores.set(s.chave, r.rows[0]!.id);
  }

  const senha = await bcrypt.hash(senhaDemo, 10);
  for (const p of DEMO_PESSOAS) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO pessoa (org_id, nome, email, senha_hash, idiomas, admin, gerente)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [orgId, p.nome, email(p.usuario), senha, p.idiomas ?? ['pt'], p.admin ?? false, p.gerente ?? false],
    );
    if (p.setor) {
      const setorId = setores.get(p.setor);
      if (!setorId) throw new Error(`setor desconhecido: ${p.setor}`);
      await client.query("INSERT INTO lotacao (org_id, pessoa_id, setor_id, papel, recebe) VALUES ($1, $2, $3, 'membro', 'sempre')", [
        orgId,
        r.rows[0]!.id,
        setorId,
      ]);
    }
  }

  const idPorQuarto = new Map<string, string>();
  for (const q of DEMO_QUARTOS) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO local (org_id, unidade_id, tipo, identificador, codigo_qr) VALUES ($1, $2, 'quarto', $3, $4) RETURNING id`,
      [orgId, unidadeId, q, gerarCodigoLocal(aleatorio)],
    );
    idPorQuarto.set(q, r.rows[0]!.id);
  }

  // Em casa de ontem até daqui a 5 dias: cobre a apresentação com folga.
  for (const h of DEMO_HOSPEDES) {
    const localId = idPorQuarto.get(h.quarto);
    if (!localId) throw new Error(`quarto de hóspede inexistente: ${h.quarto}`);
    await client.query(
      'INSERT INTO hospede_ativo (org_id, unidade_id, local_id, sobrenome, checkin, checkout) VALUES ($1, $2, $3, $4, $5, $6)',
      [orgId, unidadeId, localId, h.sobrenome, dia(-1), dia(5)],
    );
  }

  for (const k of DEMO_CONHECIMENTO) {
    await client.query(
      'INSERT INTO base_conhecimento (org_id, unidade_id, chave, pergunta, resposta, tags) VALUES ($1, $2, $3, $4, $5, $6)',
      [orgId, unidadeId, k.chave, k.pergunta, k.resposta, k.tags],
    );
  }
});

console.log(
  `demo criada: ${DEMO.organizacao} / ${DEMO.unidade}: ${DEMO_QUARTOS.length} quartos, ${DEMO_HOSPEDES.length} hóspedes, ` +
    `${DEMO_CONHECIMENTO.length} respostas na base`,
);
console.log(`logins (senha = DEMO_SENHA): ${DEMO_PESSOAS.map((p) => email(p.usuario)).join(', ')}`);
await pool.end();
