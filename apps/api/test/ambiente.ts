/**
 * Ambiente ponta a ponta: api e worker no mesmo processo (a partir do build em dist/),
 * banco local, Meta em dry-run e IA por regras. Cada arquivo de teste sobe o seu.
 */
import { createHmac, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import 'reflect-metadata';
import { carregarEnv, comTenant, criarPool, instalarFilas } from '@ramais/db';
import { expect } from 'vitest';
import { criarHotelDeTeste, SENHA } from './hotel-de-teste.js';

carregarEnv();
process.env.META_DRY_RUN = 'true';
process.env.OPENROUTER_API_KEY = '';
// Filas próprias: um worker de desenvolvimento rodando no mesmo banco não rouba os jobs do teste.
process.env.PGBOSS_SCHEMA = 'pgboss_teste';

export const temBanco = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_OWNER);

export type Hotel = Awaited<ReturnType<typeof criarHotelDeTeste>>;

export async function subirAmbiente(opcoes: { modoIa?: 'sombra' | 'automatico'; ajustes?: Record<string, unknown> } = {}) {
  await instalarFilas(process.env.DATABASE_URL_OWNER!, 'pgboss_teste');
  const owner = criarPool(process.env.DATABASE_URL_OWNER!, 2);
  const h = await criarHotelDeTeste(owner, (opcoes.ajustes ?? {}) as never, opcoes.modoIa ?? 'automatico');
  const { NestFactory } = await import('@nestjs/core');
  // @ts-ignore: módulos compilados
  const { ApiModule, WorkerModule } = await import('../dist/modulos.js');
  // @ts-ignore
  const { iniciarTempoReal } = await import('../dist/modules/tempo-real/gateway.js');
  // @ts-ignore
  const { Tokens } = await import('../dist/infra/auth.js');
  // @ts-ignore
  const { POOL, IA } = await import('../dist/infra/tokens.js');
  const api = await NestFactory.create(ApiModule, { rawBody: true, logger: ['error'] });
  // Igual ao main.api: foto e áudio chegam em base64.
  (api as unknown as { useBodyParser: (t: string, o: object) => void }).useBodyParser('json', { limit: '16mb' });
  await api.init();
  iniciarTempoReal(api.getHttpServer(), api.get(POOL), api.get(Tokens), 'http://localhost', () => undefined);
  await api.listen(0);
  const base = `http://127.0.0.1:${(api.getHttpServer().address() as AddressInfo).port}`;
  const worker = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error'] });
  await worker.init();
  const segredo = process.env.META_APP_SECRET ?? 'segredo-dev-do-app';

  async function req(metodo: string, caminho: string, corpo?: unknown, token?: string) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  }

  async function hospede(de: string, texto: string) {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '+5521900000000', phone_number_id: h.phoneNumberId },
                contacts: [{ wa_id: de, profile: { name: 'Hóspede' } }],
                messages: [{ from: de, id: `wamid.${randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: texto } }],
              },
            },
          ],
        },
      ],
    });
    const r = await fetch(`${base}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', segredo).update(payload).digest('hex')}` },
      body: payload,
    });
    expect(r.status).toBe(200);
  }

  async function consulta<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return comTenant(owner, h.orgId, async ({ client }) => (await client.query(sql, params)).rows);
  }

  async function esperar<T>(fn: () => Promise<T | null | undefined | false>, ms = 15_000): Promise<T> {
    const fim = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > fim) throw new Error('tempo esgotado esperando condição');
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const solicitacaoDe = (tel: string) =>
    consulta(
      `SELECT s.*, st.chave AS setor, sg.chave AS sugerido FROM solicitacao s JOIN solicitante so ON so.id = s.solicitante_id
       LEFT JOIN setor st ON st.id = s.setor_id LEFT JOIN setor sg ON sg.id = s.setor_sugerido_id
       WHERE so.telefone = $1 ORDER BY s.criado_em DESC LIMIT 1`,
      [tel],
    ).then((r) => r[0]);

  const saidas = (sid: string) =>
    consulta<{ texto: string; autor_tipo: string; status_envio: string }>(
      `SELECT texto, autor_tipo, status_envio FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'externa' AND autor_tipo <> 'solicitante' ORDER BY criado_em`,
      [sid],
    );

  async function login(email: string) {
    const r = await req('POST', '/auth/login', { email, senha: SENHA });
    expect(r.status).toBe(200);
    return r.corpo.token as string;
  }

  /** Sem chave de IA nos testes: o worker passa a "transcrever" todo áudio com este texto. */
  function fingirTranscricao(texto: string, idioma = 'pt') {
    worker.get(IA).multimodal = { disponivel: true, transcrever: async () => ({ texto, idioma, modelo: 'teste' }), descrever: async () => null };
  }

  async function fechar() {
    await api.close();
    await worker.close();
    await owner.end();
  }

  return { h, base, api, worker, req, hospede, consulta, esperar, solicitacaoDe, saidas, login, fingirTranscricao, fechar };
}

export type Ambiente = Awaited<ReturnType<typeof subirAmbiente>>;
