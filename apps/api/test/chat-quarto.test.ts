/**
 * Chat do quarto: o QR abre um chat no navegador e a mensagem segue o mesmo caminho do WhatsApp
 * (classificação, fila, oferta), sem Meta. Uma conversa por quarto, presa à estadia.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

const WAV = Buffer.concat([Buffer.from('RIFF\x24\x08\x00\x00WAVEfmt ', 'latin1'), Buffer.alloc(2048)]).toString('base64');

describe.skipIf(!temBanco)('chat do quarto', () => {
  let A: Ambiente;
  let tokMarcos: string;
  let tokAdmin: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    tokMarcos = await A.login(A.h.pessoas.marcos.email);
    tokAdmin = await A.login(A.h.adminEmail);
    await A.req('POST', '/turno/entrar-web', { unidadeId: A.h.unidadeId }, tokMarcos);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  async function chat(metodo: string, caminho: string, token: string, corpo?: unknown) {
    const r = await fetch(A.base + caminho, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-chat': token },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const t = await r.text();
    return { status: r.status, corpo: t ? JSON.parse(t) : null };
  }
  const abrir = async () => {
    const r = await A.req('POST', '/chat/sessao', { codigo: A.h.codigoQr, idioma: 'pt-BR' });
    expect(r.status).toBe(201);
    return r.corpo as { token: string; quarto: string; hotel: string };
  };
  const conversaDoQuarto = () =>
    A.consulta(
      `SELECT s.* FROM solicitacao s JOIN solicitante st ON st.id = s.solicitante_id WHERE st.telefone = $1 ORDER BY s.criado_em DESC LIMIT 1`,
      [`quarto:${A.h.localId}`],
    ).then((r) => r[0]);

  it('QR desconhecido não abre chat', async () => {
    expect((await A.req('POST', '/chat/sessao', { codigo: 'naoexiste' })).status).toBe(404);
    expect((await chat('GET', '/chat', 'segredo-qualquer')).status).toBe(401);
  });

  it('a mensagem do quarto é classificada, oferecida e a resposta volta para o chat', async () => {
    const s = await abrir();
    expect(s.quarto).toBe('302');
    const id = randomUUID();
    expect((await chat('POST', '/chat/mensagens', s.token, { id, texto: 'O chuveiro não esquenta' })).status).toBe(202);
    // Reenvio do mesmo id (rede caiu) não duplica.
    expect((await chat('POST', '/chat/mensagens', s.token, { id, texto: 'O chuveiro não esquenta' })).status).toBe(202);

    const oferta = await A.esperar(async () => {
      const sol = await conversaDoQuarto();
      if (!sol) return null;
      return (await A.consulta(`SELECT id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [sol.id]))[0];
    });
    const sol = await conversaDoQuarto();
    expect(sol).toMatchObject({ local_id: A.h.localId, origem: 'externa' });
    expect((await A.consulta('SELECT count(*)::int AS n FROM mensagem WHERE solicitacao_id = $1 AND autor_tipo = $2', [sol.id, 'solicitante']))[0].n).toBe(1);
    // A equipe vê "Quarto 302", não um telefone.
    const det = await A.req('GET', `/solicitacoes/${sol.id}`, undefined, tokMarcos);
    expect(det.corpo.solicitante.nome).toBe('Quarto 302');

    expect((await A.req('POST', `/ofertas/${oferta.id}/aceitar`, undefined, tokMarcos)).status).toBe(200);
    expect((await A.req('POST', `/solicitacoes/${sol.id}/mensagens`, { texto: 'Já estou subindo.', visibilidade: 'externa' }, tokMarcos)).status).toBe(201);

    const v = await A.esperar(async () => {
      const r = await chat('GET', '/chat', s.token);
      return r.corpo.mensagens.some((m: { autor: string }) => m.autor === 'equipe') ? r.corpo : null;
    });
    const minha = v.mensagens.find((m: { clienteId: string | null }) => m.clienteId === id);
    expect(minha).toMatchObject({ autor: 'hospede', texto: 'O chuveiro não esquenta' });
    expect(v.mensagens.find((m: { autor: string }) => m.autor === 'equipe')).toMatchObject({ texto: 'Já estou subindo.', autorNome: 'Marcos' });
    // Nada saiu pela Meta.
    const saida = await A.consulta(`SELECT wa_message_id FROM mensagem WHERE solicitacao_id = $1 AND autor_tipo = 'pessoa'`, [sol.id]);
    expect(saida[0].wa_message_id).toMatch(/^web\./);
  }, 40_000);

  it('a equipe encerra e o hóspede fica sabendo no chat', async () => {
    const s = await abrir();
    const sol = await conversaDoQuarto();
    expect((await A.req('POST', `/solicitacoes/${sol.id}/encerrar`, undefined, tokMarcos)).status).toBe(200);
    const aviso = await A.esperar(async () => {
      const r = await chat('GET', '/chat', s.token);
      return r.corpo.mensagens.find((m: { texto: string | null }) => m.texto?.startsWith('Encerramos este atendimento'));
    });
    expect(aviso.autor).toBe('automatica');
  }, 40_000);

  it('áudio do hóspede chega transcrito, e o outro celular do quarto vê a mesma conversa', async () => {
    A.fingirTranscricao('A toalha também está faltando.');
    const s = await abrir();
    const id = randomUUID();
    expect((await chat('POST', '/chat/midia', s.token, { id, tipo: 'audio', mime: 'audio/wav', base64: WAV })).status).toBe(202);
    const m = await A.esperar(async () => {
      const r = await chat('GET', '/chat', s.token);
      return r.corpo.mensagens.find((x: { clienteId: string | null; transcricao: string | null }) => x.clienteId === id && x.transcricao);
    });
    expect(m).toMatchObject({ tipo: 'audio', transcricao: 'A toalha também está faltando.' });
    const arq = await fetch(`${A.base}${m.midiaUrl}`, { headers: { 'x-chat': s.token } });
    expect(arq.status).toBe(200);
    expect((await fetch(`${A.base}${m.midiaUrl}`)).status).toBe(401);

    // O outro celular abre a sessão dele e vê tudo da estadia, inclusive o que veio do primeiro.
    const outro = await abrir();
    const v = await chat('GET', '/chat', outro.token);
    expect(v.corpo.mensagens.map((x: { texto: string | null }) => x.texto)).toContain('O chuveiro não esquenta');
    expect(v.corpo.mensagens.every((x: { clienteId: string | null }) => x.clienteId === null)).toBe(true);
  }, 40_000);

  it('o próximo hóspede não vê a conversa do anterior e começa um pedido novo', async () => {
    const anterior = await conversaDoQuarto();
    // A estadia anterior acabou: as mensagens ficaram antes do check-in do hóspede atual (ontem).
    await A.consulta(
      `UPDATE mensagem SET criado_em = now() - interval '3 days' WHERE solicitacao_id IN (SELECT id FROM solicitacao WHERE solicitante_id = $1)`,
      [anterior.solicitante_id],
    );
    await A.consulta(`UPDATE solicitacao SET criado_em = now() - interval '3 days' WHERE solicitante_id = $1`, [anterior.solicitante_id]);
    const s = await abrir();
    expect((await chat('GET', '/chat', s.token)).corpo.mensagens).toEqual([]);

    await chat('POST', '/chat/mensagens', s.token, { id: randomUUID(), texto: 'Que horas é o café da manhã?' });
    const nova = await A.esperar(async () => {
      const x = await conversaDoQuarto();
      return x && x.id !== anterior.id ? x : null;
    });
    expect(nova.local_id).toBe(A.h.localId);
  }, 40_000);

  it('o admin escolhe o chat como destino do QR; um código novo derruba as sessões abertas', async () => {
    expect((await A.req('PUT', '/admin/quartos/destino', { unidadeId: A.h.unidadeId, destino: 'web' }, tokAdmin)).status).toBe(200);
    const q = await A.req('GET', `/admin/quartos?unidadeId=${A.h.unidadeId}`, undefined, tokAdmin);
    expect(q.corpo.destino).toBe('web');
    expect(q.corpo.quartos.find((x: { id: string }) => x.id === A.h.localId).link).toMatch(new RegExp(`/q/${A.h.codigoQr}$`));
    expect((await A.req('PUT', '/admin/quartos/destino', { unidadeId: A.h.unidadeId, destino: 'web' }, tokMarcos)).status).toBe(403);

    const s = await abrir();
    expect((await A.req('POST', `/admin/quartos/${A.h.localId}/novo-codigo`, undefined, tokAdmin)).status).toBe(200);
    expect((await chat('GET', '/chat', s.token)).status).toBe(401);
    expect((await A.req('POST', '/chat/sessao', { codigo: A.h.codigoQr })).status).toBe(404);
  });
});
