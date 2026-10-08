/**
 * Mensagens diretas (o "ramal" entre pessoas): busca por nome ou setor, envio, urgente com
 * "ciente" e push que toca no celular de quem recebe.
 */
import { io } from 'socket.io-client';
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

  it('sem busca, lista a equipe toda: online primeiro, depois no turno, com quantos atende', async () => {
    const { h, req, login } = A;
    const tokMarcos = await login(h.pessoas.marcos.email);
    const tokMauro = await login(h.pessoas.mauro.email);
    // Mauro com a web aberta (socket de tempo real conectado).
    const sock = io(A.base, { path: '/tempo-real', transports: ['websocket'], auth: { token: tokMauro } });
    await new Promise<void>((ok, erro) => {
      sock.on('connect', () => ok());
      sock.on('connect_error', erro);
    });
    try {
      const equipe = await A.esperar(async () => {
        const r = await req('GET', `/pessoas?unidadeId=${h.unidadeId}&busca=`, undefined, tokMarcos);
        return r.corpo[0]?.online ? r.corpo : null;
      });
      const nomes = equipe.map((p: { nome: string }) => p.nome);
      expect(nomes.slice(0, 2)).toEqual(['Mauro', 'Rita']);
      expect(nomes).toEqual(expect.arrayContaining(['Marcos', 'Milton']));
      expect(equipe[1]).toMatchObject({ online: false, emTurno: true });
      expect(equipe.every((p: { atendendo: number }) => typeof p.atendendo === 'number')).toBe(true);
    } finally {
      sock.disconnect();
    }
    const depois = await A.esperar(async () => {
      const r = await req('GET', `/pessoas?unidadeId=${h.unidadeId}&busca=mauro`, undefined, tokMarcos);
      return r.corpo[0]?.online === false ? r.corpo[0] : null;
    });
    expect(depois.nome).toBe('Mauro');
  });
});
