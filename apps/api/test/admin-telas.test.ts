/**
 * Telas de administração: equipe (senha temporária, PIN, lotação, desativar),
 * base de conhecimento, quartos em lote e relatório.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('administração', () => {
  let A: Ambiente;
  let tok: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    tok = await A.login(A.h.adminEmail);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  it('cria pessoa com senha temporária, que troca no primeiro acesso e recebe pedidos do setor', async () => {
    const email = `nova.${Date.now()}@teste.dev`;
    const r = await A.req(
      'POST',
      '/admin/pessoas',
      {
        unidadeId: A.h.unidadeId,
        nome: 'Nina Nova',
        email,
        idiomas: ['pt', 'es'],
        lotacoes: [{ setorId: A.h.setores.governanca, papel: 'membro', recebe: 'sempre' }],
      },
      tok,
    );
    expect(r.status).toBe(201);
    expect(r.corpo.senhaTemporaria).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(r.corpo.pin).toMatch(/^\d{6}$/);
    // E-mail repetido: erro claro, não 500.
    expect((await A.req('POST', '/admin/pessoas', { unidadeId: A.h.unidadeId, nome: 'Outra', email }, tok)).status).toBe(409);

    const login = await A.req('POST', '/auth/login', { email, senha: r.corpo.senhaTemporaria });
    expect(login.status).toBe(200);
    expect(login.corpo.pessoa.trocarSenha).toBe(true);
    const tokNina = login.corpo.token;
    expect((await A.req('POST', '/auth/senha', { atual: r.corpo.senhaTemporaria, nova: 'curta' }, tokNina)).status).toBe(400);
    expect((await A.req('POST', '/auth/senha', { atual: r.corpo.senhaTemporaria, nova: 'minha-senha-nova-123' }, tokNina)).status).toBe(200);
    const eu = await A.req('GET', '/auth/eu', undefined, tokNina);
    expect(eu.corpo.pessoa.trocarSenha).toBe(false);

    // Lotada em Governança: no turno, recebe o pedido de toalhas.
    await A.req('POST', '/turno/entrar-web', { unidadeId: A.h.unidadeId }, tokNina);
    await A.hospede('5521955550001', 'Podem trazer toalhas?');
    await A.esperar(async () => (await A.req('GET', '/ofertas', undefined, tokNina)).corpo.length > 0);

    // Desativar tira do turno e devolve a oferta para a fila.
    const lista = await A.req('GET', `/admin/pessoas?unidadeId=${A.h.unidadeId}`, undefined, tok);
    const nina = lista.corpo.find((p: { email: string }) => p.email === email);
    expect(nina).toMatchObject({ emTurno: true, temPin: true, trocarSenha: false });
    expect(
      (
        await A.req(
          'PUT',
          `/admin/pessoas/${nina.id}`,
          { unidadeId: A.h.unidadeId, nome: 'Nina Nova', idiomas: ['pt'], admin: false, ativo: false, lotacoes: nina.lotacoes },
          tok,
        )
      ).status,
    ).toBe(200);
    const [pres] = await A.consulta('SELECT count(*)::int AS n FROM presenca WHERE pessoa_id = $1 AND fim IS NULL', [nina.id]);
    expect(pres.n).toBe(0);
    expect((await A.req('POST', '/auth/login', { email, senha: 'minha-senha-nova-123' })).status).toBe(401);
  });

  it('redefine PIN (e desbloqueia) e não deixa o admin tirar o próprio acesso', async () => {
    const lista = await A.req('GET', `/admin/pessoas?unidadeId=${A.h.unidadeId}`, undefined, tok);
    const rita = lista.corpo.find((p: { email: string }) => p.email === A.h.pessoas.rita.email);
    await A.consulta(`UPDATE pessoa SET pin_falhas = 0, pin_bloqueado_ate = now() + interval '1 hour' WHERE id = $1`, [rita.id]);
    const r = await A.req('POST', `/admin/pessoas/${rita.id}/redefinir`, { pin: true }, tok);
    expect(r.corpo.pin).toMatch(/^\d{6}$/);
    expect(r.corpo.senhaTemporaria).toBeUndefined();
    const [p] = await A.consulta('SELECT pin_bloqueado_ate FROM pessoa WHERE id = $1', [rita.id]);
    expect(p.pin_bloqueado_ate).toBeNull();

    const eu = lista.corpo.find((x: { email: string }) => x.email === A.h.adminEmail);
    const r2 = await A.req('PUT', `/admin/pessoas/${eu.id}`, { unidadeId: A.h.unidadeId, nome: 'Admin', idiomas: ['pt'], admin: false, ativo: true, lotacoes: [] }, tok);
    expect(r2.status).toBe(400);
    // Quem não é admin não acessa.
    const tokRita = await A.login(A.h.pessoas.rita.email);
    expect((await A.req('GET', `/admin/pessoas?unidadeId=${A.h.unidadeId}`, undefined, tokRita)).status).toBe(403);
  });

  it('base de conhecimento: cadastra, testa e a IA responde o hóspede com ela', async () => {
    const c = await A.req(
      'POST',
      '/admin/conhecimento',
      { unidadeId: A.h.unidadeId, pergunta: 'Qual o horário da piscina?', resposta: 'A piscina abre das 8h às 20h.', tags: ['piscina', 'pool'] },
      tok,
    );
    expect(c.status).toBe(201);
    const t = await A.req('POST', '/admin/conhecimento/testar', { unidadeId: A.h.unidadeId, pergunta: 'Que horas abre a piscina?' }, tok);
    expect(t.corpo).toMatchObject({ responderia: true, resposta: 'A piscina abre das 8h às 20h.' });

    await A.hospede('5521955550002', 'Que horas abre a piscina?');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe('5521955550002');
      return x?.estado === 'resolvida' ? x : null;
    });
    expect((await A.saidas(s.id)).map((m) => m.texto)).toContain('A piscina abre das 8h às 20h.');

    // Desativado, não responde mais.
    expect((await A.req('PUT', `/admin/conhecimento/${c.corpo.id}`, { pergunta: 'Qual o horário da piscina?', resposta: 'Fechada.', tags: ['piscina'], ativo: false }, tok)).status).toBe(200);
    const t2 = await A.req('POST', '/admin/conhecimento/testar', { unidadeId: A.h.unidadeId, pergunta: 'Que horas abre a piscina?' }, tok);
    expect(t2.corpo.responderia).toBe(false);
  });

  it('quartos em lote, sem duplicar, e QR novo invalida o antigo', async () => {
    const r = await A.req('POST', '/admin/quartos', { unidadeId: A.h.unidadeId, identificadores: '401-405, 302, Suíte Master' }, tok);
    expect(r.corpo).toEqual({ criados: 6, existentes: 1 });
    const lista = await A.req('GET', `/admin/quartos?unidadeId=${A.h.unidadeId}`, undefined, tok);
    expect(lista.corpo.quartos.map((q: { identificador: string }) => q.identificador)).toEqual(expect.arrayContaining(['401', '405', 'Suíte Master']));
    const q302 = lista.corpo.quartos.find((q: { identificador: string }) => q.identificador === '302');
    expect(q302.link).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect((await A.req('POST', `/admin/quartos/${q302.id}/novo-codigo`, undefined, tok)).status).toBe(200);
    const depois = (await A.req('GET', `/admin/quartos?unidadeId=${A.h.unidadeId}`, undefined, tok)).corpo.quartos.find((q: { id: string }) => q.id === q302.id);
    expect(depois.link).not.toBe(q302.link);
  });

  it('admin vê as listas da unidade e de fechadas', async () => {
    for (const filtro of ['minhas', 'setores', 'unidade', 'fechadas']) {
      const r = await A.req('GET', `/solicitacoes?filtro=${filtro}&unidadeId=${A.h.unidadeId}`, undefined, tok);
      expect(r.status, filtro).toBe(200);
    }
    const r = await A.req('GET', `/solicitacoes?filtro=fechadas&unidadeId=${A.h.unidadeId}`, undefined, tok);
    expect(r.corpo.length).toBeGreaterThanOrEqual(1);
  });

  it('relatório traz pedidos, IA e pesquisa sem contar o simulador', async () => {
    const r = await A.req('GET', `/admin/relatorio?unidadeId=${A.h.unidadeId}&dias=7`, undefined, tok);
    expect(r.status).toBe(200);
    expect(r.corpo.geral.pedidos).toBeGreaterThanOrEqual(2);
    expect(r.corpo.geral.pelaIa).toBeGreaterThanOrEqual(1);
    expect(r.corpo.porHora).toHaveLength(24);
    expect(r.corpo.porDia).toHaveLength(7);
    expect(r.corpo.pesquisa.distribuicao).toHaveLength(5);
    expect(r.corpo.setores.find((x: { nome: string }) => x.nome === 'Governança').pedidos).toBeGreaterThanOrEqual(1);
  });

  it('uso do mês para a simulação: pedidos e mensagens por canal, só para gestão', async () => {
    const r = await A.req('GET', `/admin/relatorio/mes?unidadeId=${A.h.unidadeId}`, undefined, tok);
    expect(r.status).toBe(200);
    expect(r.corpo.diasNoMes).toBeGreaterThanOrEqual(28);
    expect(r.corpo.diasDecorridos).toBeGreaterThan(0);
    expect(r.corpo.diasDecorridos).toBeLessThanOrEqual(r.corpo.diasNoMes);
    expect(r.corpo.pedidos.whatsapp).toBeGreaterThanOrEqual(2);
    expect(r.corpo.mensagensHospede.whatsapp).toBeGreaterThanOrEqual(r.corpo.pedidos.whatsapp);
    expect(r.corpo.mensagensHotel.whatsapp).toBeGreaterThanOrEqual(1);
    expect(r.corpo.quartos).toBeGreaterThanOrEqual(1);
    expect(typeof r.corpo.iaUsd).toBe('number');
    const tokRita = await A.login(A.h.pessoas.rita.email);
    expect((await A.req('GET', `/admin/relatorio/mes?unidadeId=${A.h.unidadeId}`, undefined, tokRita)).status).toBe(403);
  });
});
