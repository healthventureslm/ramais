/**
 * Mensagens diretas (o "ramal" entre pessoas): busca por nome ou setor, envio, urgente com
 * "ciente" e push que toca no celular de quem recebe.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('mensagens diretas', () => {
  let A: Ambiente;

  beforeAll(async () => {
    A = await subirAmbiente();
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  it('acha por setor, manda urgente, a outra pessoa dá ciente', async () => {
    const { h, req, login } = A;
    const tokMarcos = await login(h.pessoas.marcos.email);
    const tokRita = await login(h.pessoas.rita.email);
    await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, tokRita);

    // "recep" acha a Rita pelo setor (Recepção), e quem está no turno vem primeiro.
    const busca = await req('GET', `/pessoas?unidadeId=${h.unidadeId}&busca=recep`, undefined, tokMarcos);
    expect(busca.corpo.map((p: { nome: string }) => p.nome)).toEqual(['Rita']);
    expect(busca.corpo[0].emTurno).toBe(true);
    const manut = await req('GET', `/pessoas?unidadeId=${h.unidadeId}&busca=manuten`, undefined, tokMarcos);
    expect(manut.corpo.map((p: { nome: string }) => p.nome).sort()).toEqual(['Marcos', 'Mauro', 'Milton']);

    const env = await req('POST', '/diretas', { paraPessoaId: h.pessoas.rita.id, texto: 'Hóspede do 302 chegando, pode separar o cartão?', urgente: true }, tokMarcos);
    expect(env.status).toBe(201);
    expect(env.corpo.foraDoTurno).toBe(false);
    // Push com a marca de urgente, para o app tocar como oferta.
    const [job] = await A.consulta(
      `SELECT data FROM pgboss_teste.job WHERE name = 'notificacao' AND data->>'pessoaId' = $1 ORDER BY created_on DESC LIMIT 1`,
      [h.pessoas.rita.id],
    );
    expect(job.data.dados).toMatchObject({ tipo: 'direta', urgente: 'true' });

    const lista = await req('GET', '/diretas', undefined, tokRita);
    expect(lista.corpo[0]).toMatchObject({ urgentes_pendentes: 1, outros: [{ id: h.pessoas.marcos.id }] });
    const msgs = await req('GET', `/diretas/${env.corpo.conversaId}`, undefined, tokRita);
    expect((await req('POST', `/diretas/mensagens/${msgs.corpo[0].id}/ciente`, undefined, tokRita)).corpo.ok).toBe(true);
    expect((await req('GET', '/diretas', undefined, tokRita)).corpo[0].urgentes_pendentes).toBe(0);

    // Resposta cai na mesma conversa.
    const resp = await req('POST', '/diretas', { paraPessoaId: h.pessoas.marcos.id, texto: 'Separado!', urgente: false }, tokRita);
    expect(resp.corpo.conversaId).toBe(env.corpo.conversaId);
  });
});
