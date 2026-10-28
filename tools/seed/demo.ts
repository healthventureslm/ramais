/**
 * Cria o hotel de demonstração (demo-dados.ts) numa organização própria, separada do Hotel
 * Piloto: unidade, setores, logins (admin, gerente e um por setor), quartos com QR para o chat
 * do quarto, hóspedes em casa, base de conhecimento e catálogo (room service, spa, passeios…).
 *
 * Todos os logins usam a mesma senha, DEMO_SENHA (6+ caracteres): é para apresentação. Troque
 * ou desative as contas antes de o hotel usar de verdade.
 *
 * Idempotente: se o login do admin já existe, só acrescenta as entradas novas da base de
 * conhecimento e os itens novos do catálogo (por categoria + nome). Em produção roda no contêiner de
 * migração quando DEMO_SENHA está definida (docker-compose.api.yml).
 *   DEMO_SENHA=... pnpm --filter @ramais/seed demo
 */
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { carregarEnv, comTenant, criarPool, type Tx } from '@ramais/db';
import { gerarCodigoLocal } from '@ramais/domain';
import { configHotel } from '@ramais/vertical-hotel';

import { DEMO, DEMO_CATALOGO, DEMO_CONHECIMENTO, DEMO_HOSPEDES, DEMO_PESSOAS, DEMO_QUARTOS } from './demo-dados.js';

carregarEnv();
const url = process.env.DATABASE_URL_OWNER;
if (!url) throw new Error('defina DATABASE_URL_OWNER');
const senhaDemo = process.env.DEMO_SENHA ?? '';
if (senhaDemo.length < 6) throw new Error('defina DEMO_SENHA com 6 ou mais caracteres');

const email = (usuario: string) => `${usuario}@${DEMO.dominioEmail}`;
const pool = criarPool(url, 2);
const aleatorio = (n: number) => new Uint8Array(randomBytes(n));

/**
 * Insere os itens do catálogo que a unidade ainda não tem (mesma categoria e nome). O que já existe,
 * mesmo editado ou desativado na tela de administração, fica como está. Devolve quantos entraram.
 */
async function sincronizarCatalogo(client: Tx['client'], orgId: string, unidadeId: string): Promise<number> {
  const s = await client.query<{ chave: string; id: string }>('SELECT chave, id FROM setor WHERE unidade_id = $1', [unidadeId]);
  const setores = new Map(s.rows.map((r) => [r.chave, r.id]));
  let n = 0;
  for (const [ordem, i] of DEMO_CATALOGO.entries()) {
    const setorId = setores.get(i.setor);
    if (!setorId) throw new Error(`setor desconhecido no catálogo: ${i.setor}`);
    const r = await client.query(
      `INSERT INTO catalogo_item (org_id, unidade_id, setor_id, tipo, categoria, nome, descricao, nomes, descricoes, preco_centavos,
         por_pessoa, max_quantidade, duracao_min, capacidade, vagas_por, horarios, antecedencia_min, dias_a_frente, ordem)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
       WHERE NOT EXISTS (SELECT 1 FROM catalogo_item WHERE unidade_id = $2 AND categoria = $5 AND nome = $6)`,
      [
        orgId,
        unidadeId,
        setorId,
        i.tipo,
        i.categoria,
        i.nome,
        i.descricao,
        JSON.stringify(i.nomes),
        JSON.stringify(i.descricoes ?? {}),
        i.precoCentavos,
        i.porPessoa ?? false,
        i.maxQuantidade ?? 10,
        i.duracaoMin ?? null,
        i.capacidade ?? null,
        i.vagasPor ?? 'pessoa',
        JSON.stringify(i.horarios ?? []),
        i.antecedenciaMin ?? 60,
        i.diasAFrente ?? 14,
        ordem,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

// Como dono, sem tenant, a RLS esconde tudo: a checagem usa a função de sistema do login.
const ja = await pool.query<{ org_id: string }>('SELECT * FROM sistema.resolver_login($1)', [email('admin')]);
if (ja.rows.length) {
  // Hotel já criado: só acrescenta à base as entradas novas deste arquivo. O que já existe (mesmo
  // editado ou desativado na tela de administração) fica como está.
  const novas = await comTenant(pool, ja.rows[0]!.org_id, async ({ client }) => {
    const u = await client.query<{ id: string }>('SELECT id FROM unidade WHERE nome = $1', [DEMO.unidade]);
    if (!u.rows[0]) return { base: 0, catalogo: 0 };
    let n = 0;
    for (const k of DEMO_CONHECIMENTO) {
      const r = await client.query(
        `INSERT INTO base_conhecimento (org_id, unidade_id, chave, pergunta, resposta, tags) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (unidade_id, chave) DO NOTHING`,
        [ja.rows[0]!.org_id, u.rows[0].id, k.chave, k.pergunta, k.resposta, k.tags],
      );
      n += r.rowCount ?? 0;
    }
    return { base: n, catalogo: await sincronizarCatalogo(client, ja.rows[0]!.org_id, u.rows[0].id) };
  });
  console.log(
    `demo já existe (${DEMO.unidade}, login ${email('admin')}). Base de conhecimento: ${novas.base} entrada(s) nova(s); ` +
      `catálogo: ${novas.catalogo} item(ns) novo(s).`,
  );
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

  await sincronizarCatalogo(client, orgId, unidadeId);
});

console.log(
  `demo criada: ${DEMO.organizacao} / ${DEMO.unidade}: ${DEMO_QUARTOS.length} quartos, ${DEMO_HOSPEDES.length} hóspedes, ` +
    `${DEMO_CONHECIMENTO.length} respostas na base, ${DEMO_CATALOGO.length} itens no catálogo`,
);
console.log(`logins (senha = DEMO_SENHA): ${DEMO_PESSOAS.map((p) => email(p.usuario)).join(', ')}`);
await pool.end();
