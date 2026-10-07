import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { comTenant } from '@ramais/db';
import { configHotel } from '@ramais/vertical-hotel';
import type pg from 'pg';

export const SENHA = 'senha-de-teste-123';
export const PIN = '654321';

/** Cria uma organização isolada, com número próprio, para cada execução de teste. */
export async function criarHotelDeTeste(
  owner: pg.Pool,
  ajustes: Partial<typeof configHotel> = {},
  modoIa: 'sombra' | 'automatico' = 'automatico',
) {
  const orgId = randomUUID();
  const phoneNumberId = `teste-${randomUUID()}`;
  const sufixo = randomBytes(4).toString('hex');
  return comTenant(owner, orgId, async ({ client }) => {
    await client.query('INSERT INTO organizacao (id, nome) VALUES ($1, $2)', [orgId, `Org teste ${sufixo}`]);
    const unidadeId = (await client.query('INSERT INTO unidade (org_id, nome) VALUES ($1, $2) RETURNING id', [orgId, 'Hotel Teste'])).rows[0].id;
    const cfg = { ...configHotel, ...ajustes };
    const jv = (
      await client.query('INSERT INTO jornada_versao (org_id, unidade_id, numero, config) VALUES ($1, $2, 1, $3) RETURNING id', [
        orgId,
        unidadeId,
        JSON.stringify(cfg),
      ])
    ).rows[0].id;
    await client.query('UPDATE unidade SET jornada_versao_id = $2 WHERE id = $1', [unidadeId, jv]);
    await client.query(
      `INSERT INTO canal_whatsapp (org_id, unidade_id, phone_number_id, waba_id, numero_exibicao, modo_credencial, credencial_ref)
       VALUES ($1, $2, $3, 'waba', '+5521900000000', 'propria', 'META_TOKEN')`,
      [orgId, unidadeId, phoneNumberId],
    );
    const setores: Record<string, string> = {};
    for (const s of cfg.setores) {
      setores[s.chave] = (
        await client.query('INSERT INTO setor (org_id, unidade_id, chave, nome, modo_ia) VALUES ($1, $2, $3, $4, $5) RETURNING id', [orgId, unidadeId, s.chave, s.nome, modoIa])
      ).rows[0].id;
    }
    const senha = await bcrypt.hash(SENHA, 4);
    const pin = await bcrypt.hash(PIN, 4);
    const pessoa = async (nome: string, setor: string, papel: 'membro' | 'supervisor', recebe = 'sempre') => {
      const email = `${nome.toLowerCase()}.${sufixo}@teste.dev`;
      const id = (
        await client.query('INSERT INTO pessoa (org_id, nome, email, senha_hash, pin_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
          orgId,
          nome,
          email,
          senha,
          pin,
        ])
      ).rows[0].id;
      await client.query('INSERT INTO lotacao (org_id, pessoa_id, setor_id, papel, recebe) VALUES ($1, $2, $3, $4, $5)', [
        orgId,
        id,
        setores[setor],
        papel,
        recebe,
      ]);
      return { id, email };
    };
    const marcos = await pessoa('Marcos', 'manutencao', 'membro');
    const milton = await pessoa('Milton', 'manutencao', 'membro');
    const mauro = await pessoa('Mauro', 'manutencao', 'supervisor', 'ultimo_recurso');
    const rita = await pessoa('Rita', 'recepcao', 'membro');
    const adminEmail = `admin.${sufixo}@teste.dev`;
    await client.query('INSERT INTO pessoa (org_id, nome, email, senha_hash, admin) VALUES ($1, $2, $3, $4, true)', [orgId, 'Admin', adminEmail, senha]);
    const codigoQr = `T${sufixo}x`;
    const localId = (
      await client.query(`INSERT INTO local (org_id, unidade_id, identificador, codigo_qr) VALUES ($1, $2, '302', $3) RETURNING id`, [
        orgId,
        unidadeId,
        codigoQr,
      ])
    ).rows[0].id;
    await client.query(
      `INSERT INTO hospede_ativo (org_id, unidade_id, local_id, sobrenome, checkin, checkout)
       VALUES ($1, $2, $3, 'Silva', current_date - 1, current_date + 2)`,
      [orgId, unidadeId, localId],
    );
    return { orgId, unidadeId, phoneNumberId, setores, codigoQr, localId, pessoas: { marcos, milton, mauro, rita }, adminEmail };
  });
}
