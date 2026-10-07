/**
 * Ponta a ponta do atendimento, com todos os setores no automático.
 * Precisa de `pnpm db:setup && pnpm db:migrate`; sem banco, é pulado.
 */
import { io } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('fluxo do hotel', () => {
  let A: Ambiente;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  it('webhook sem assinatura válida é recusado', async () => {
    const r = await fetch(`${A.base}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' },
      body: '{}',
    });
    expect(r.status).toBe(401);
  });

  it('do WhatsApp ao atendimento: roteia, oferta, aceita, responde, resolve', async () => {
    const { h, req, hospede, esperar, solicitacaoDe, saidas, login, consulta } = A;
    const tel = '5521911110001';
    await hospede(tel, `O ar condicionado está pingando (código #R-${h.codigoQr})`);
    const s = await esperar(async () => {
      const x = await solicitacaoDe(tel);
      return x?.estado === 'na_fila' ? x : null;
    });
    expect(s.setor).toBe('manutencao');
    expect(s.triagem).toBe(false);
    expect(s.local_id).toBe(h.localId);
    expect(s.identificado).toBe(false); // QR só vale para pedido de baixo risco

    // Ninguém em turno: nada é ofertado. Marcos entra e recebe a oferta (também em tempo real).
    const tok = await login(h.pessoas.marcos.email);
    const recebidos: string[] = [];
    const sock = io(A.base, { path: '/tempo-real', transports: ['websocket'], auth: { token: tok } });
    sock.onAny((ev: string) => recebidos.push(ev));
    await new Promise<void>((ok, erro) => {
      sock.on('connect', () => ok());
      sock.on('connect_error', erro);
    });
    // O servidor entra nas salas de forma assíncrona após o connect.
    await new Promise((r) => setTimeout(r, 300));
    expect((await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, tok)).status).toBe(200);
    const ofertas = await esperar(async () => {
      const r = await req('GET', '/ofertas', undefined, tok);
      return r.corpo.length ? r.corpo : null;
    });
    await esperar(async () => recebidos.includes('oferta:nova'));
    sock.disconnect();
    const aceite = await req('POST', `/ofertas/${ofertas[0].ofertaId}/aceitar`, undefined, tok);
    expect(aceite.status).toBe(200);
    // Aceitar de novo falha: o aceite é atômico.
    expect((await req('POST', `/ofertas/${ofertas[0].ofertaId}/aceitar`, undefined, tok)).status).toBe(409);

    // Outra pessoa (recepção) não responde ao hóspede.
    const tokRita = await login(h.pessoas.rita.email);
    expect((await req('POST', `/solicitacoes/${s.id}/mensagens`, { texto: 'oi', visibilidade: 'externa' }, tokRita)).status).toBe(403);

    expect((await req('POST', `/solicitacoes/${s.id}/mensagens`, { texto: 'Estou a caminho do 302.', visibilidade: 'externa' }, tok)).status).toBe(201);
    expect((await req('POST', `/solicitacoes/${s.id}/mensagens`, { texto: 'dreno entupido', visibilidade: 'interna' }, tok)).status).toBe(201);
    await esperar(async () => (await saidas(s.id)).some((m) => m.texto === 'Estou a caminho do 302.' && m.status_envio === 'enviada'));
    // A nota interna nunca sai.
    expect((await saidas(s.id)).some((m) => m.texto === 'dreno entupido')).toBe(false);
    expect((await solicitacaoDe(tel)).estado).toBe('aguardando_solicitante');

    await hospede(tel, 'obrigado, estou no quarto');
    await esperar(async () => (await solicitacaoDe(tel)).estado === 'em_atendimento');

    expect((await req('POST', `/solicitacoes/${s.id}/resolver`, undefined, tok)).status).toBe(200);
    await esperar(async () => (await saidas(s.id)).some((m) => m.texto.includes('concluído') && m.status_envio === 'enviada'));
    expect((await solicitacaoDe(tel)).estado).toBe('resolvida');

    // Abrir o detalhe fica na trilha de auditoria; quem não é do setor não abre.
    expect((await req('GET', `/solicitacoes/${s.id}`, undefined, tok)).status).toBe(200);
    expect((await req('GET', `/solicitacoes/${s.id}`, undefined, tokRita)).status).toBe(403);
    const eventos = await consulta<{ tipo: string }>('SELECT tipo FROM evento WHERE solicitacao_id = $1 ORDER BY id', [s.id]);
    expect(eventos.map((e) => e.tipo)).toEqual(expect.arrayContaining(['criada', 'vinculo_qr', 'decisao_ia', 'encaminhada', 'aceita', 'visualizada', 'resolvida']));
  }, 60_000);

  it('oferta sem aceite redistribui e, pelo tempo de espera, a escada chama o supervisor', async () => {
    const { h, req, hospede, esperar, solicitacaoDe, login, consulta } = A;
    const tel = '5521911110002';
    const tokMilton = await login(h.pessoas.milton.email);
    const tokMauro = await login(h.pessoas.mauro.email);
    await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, tokMilton);
    await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, tokMauro);
    await hospede(tel, 'A TV não liga');
    const s = await esperar(async () => {
      const x = await solicitacaoDe(tel);
      return x?.estado === 'oferecida' ? x : null;
    });
    expect(s.espera_desde).not.toBeNull();
    // Força o vencimento das ofertas e dispara o temporizador (como o pg-boss faria).
    // @ts-ignore: módulo compilado
    const { Distribuicao } = await import('../dist/modules/distribuicao/distribuicao.service.js');
    // @ts-ignore: módulo compilado
    const { Escalonamento } = await import('../dist/modules/distribuicao/escada.service.js');
    const dist = A.worker.get(Distribuicao);
    const pessoas: string[] = [];
    for (let i = 0; i < 2; i++) {
      const o = await esperar(async () => (await consulta(`SELECT id, pessoa_id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [s.id]))[0]);
      pessoas.push(o.pessoa_id);
      await consulta(`UPDATE oferta SET expira_em = now() - interval '1 second' WHERE id = $1`, [o.id]);
      await dist.ofertaExpirou(h.orgId, o.id);
    }
    // O supervisor ("último recurso") só recebe depois que os membros deixaram expirar.
    expect(pessoas[0]).not.toBe(h.pessoas.mauro.id);
    expect((await solicitacaoDe(tel)).expiracoes).toBe(2);
    expect((await solicitacaoDe(tel)).supervisor_notificado_em).toBeNull();

    // Três minutos de espera (padrão da escada): chama os supervisores do setor que estão no turno.
    await consulta(`UPDATE solicitacao SET espera_desde = now() - interval '200 seconds' WHERE id = $1`, [s.id]);
    await A.worker.get(Escalonamento).avaliar(h.orgId, s.id);
    const final = await solicitacaoDe(tel);
    expect(final.supervisor_notificado_em).not.toBeNull();
    const [ev] = await consulta(`SELECT dados FROM evento WHERE solicitacao_id = $1 AND tipo = 'escalonada'`, [s.id]);
    expect(ev.dados).toMatchObject({ degrau: 1, motivo: 'sem_aceite', destinatarios: [h.pessoas.mauro.id] });

    // Dois "pegar" ao mesmo tempo: só um ganha.
    const [a, b] = await Promise.all([
      req('POST', `/solicitacoes/${s.id}/pegar`, undefined, tokMauro),
      req('POST', `/solicitacoes/${s.id}/pegar`, undefined, tokMilton),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  }, 60_000);

  it('gatilhos: emergência interrompe tudo e "sair" encerra', async () => {
    const { hospede, esperar, solicitacaoDe, saidas } = A;
    const tel = '5521911110003';
    await hospede(tel, 'Socorro! Tem fumaça e fogo no corredor');
    const s = await esperar(async () => {
      const x = await solicitacaoDe(tel);
      return x?.urgencia === 'agora' ? x : null;
    });
    expect(['na_fila', 'oferecida']).toContain(s.estado);
    await esperar(async () => (await saidas(s.id)).some((m) => m.texto.includes('193')));

    const tel2 = '5521911110004';
    await hospede(tel2, 'oi');
    await esperar(async () => (await solicitacaoDe(tel2))?.contexto?.fluxo?.perguntouDetalhe);
    await hospede(tel2, 'sair');
    await esperar(async () => (await solicitacaoDe(tel2)).estado === 'cancelada');
  }, 60_000);
});
