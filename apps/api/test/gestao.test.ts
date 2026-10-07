/**
 * Níveis de acesso: gerente (vê e atende tudo, vê o relatório, não configura) e a supervisão
 * acompanhando quem está atendendo no setor e assumindo a conversa quando precisa.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('gestão: gerente e supervisão', () => {
  let A: Ambiente;
  let tokAdmin: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    tokAdmin = await A.login(A.h.adminEmail);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  it('gerente vê todos os pedidos e o relatório, mas não a equipe nem a jornada', async () => {
    const email = `gerente.${Date.now()}@teste.dev`;
    const r = await A.req('POST', '/admin/pessoas', { unidadeId: A.h.unidadeId, nome: 'Gilda Gerente', email, gerente: true }, tokAdmin);
    expect(r.status).toBe(201);
    const login = await A.req('POST', '/auth/login', { email, senha: r.corpo.senhaTemporaria });
    expect(login.corpo.pessoa).toMatchObject({ gerente: true, admin: false });
    expect(login.corpo.unidades.map((u: { id: string }) => u.id)).toContain(A.h.unidadeId);
    const tok = login.corpo.token;

    await A.hospede('5521966660001', 'A torneira está pingando');
    await A.esperar(async () => (await A.solicitacaoDe('5521966660001'))?.setor === 'manutencao');
    const hotel = await A.req('GET', `/solicitacoes?filtro=unidade&unidadeId=${A.h.unidadeId}`, undefined, tok);
    expect(hotel.status).toBe(200);
    expect(hotel.corpo.length).toBeGreaterThan(0);
    expect((await A.req('GET', `/dashboard?unidadeId=${A.h.unidadeId}`, undefined, tok)).status).toBe(200);
    expect((await A.req('GET', `/admin/relatorio?unidadeId=${A.h.unidadeId}&dias=7`, undefined, tok)).status).toBe(200);
    expect((await A.req('GET', `/admin/pessoas?unidadeId=${A.h.unidadeId}`, undefined, tok)).status).toBe(403);
    expect((await A.req('GET', `/admin/jornada?unidadeId=${A.h.unidadeId}`, undefined, tok)).status).toBe(403);

    // Sem setor, a gerência aparece na busca da equipe e recebe mensagem direta.
    const tokMarcos = await A.login(A.h.pessoas.marcos.email);
    const busca = await A.req('GET', `/pessoas?unidadeId=${A.h.unidadeId}&busca=Gilda`, undefined, tokMarcos);
    expect(busca.corpo.find((x: { nome: string }) => x.nome === 'Gilda Gerente')).toMatchObject({ setores: 'Gerência' });
    const gilda = busca.corpo.find((x: { nome: string }) => x.nome === 'Gilda Gerente').id;
    expect((await A.req('POST', '/diretas', { paraPessoaId: gilda, texto: 'Pode passar no 302?' }, tokMarcos)).status).toBe(201);
    expect((await A.req('GET', '/diretas', undefined, tok)).corpo[0].ultima.texto).toBe('Pode passar no 302?');
  });

  it('supervisão vê quem está atendendo no setor e assume; funcionário comum não', async () => {
    const { h, req, login } = A;
    const tokMarcos = await login(h.pessoas.marcos.email);
    const tokMilton = await login(h.pessoas.milton.email);
    const tokMauro = await login(h.pessoas.mauro.email);
    const tokRita = await login(h.pessoas.rita.email);
    for (const t of [tokMarcos, tokMilton, tokMauro]) await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, t);

    const tel = '5521966660002';
    await A.hospede(tel, 'O chuveiro não esquenta');
    const oferta = await A.esperar(async () => {
      const s = await A.solicitacaoDe(tel);
      if (!s) return null;
      return (await A.consulta(`SELECT id, pessoa_id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [s.id]))[0];
    });
    const tokDe: Record<string, string> = { [h.pessoas.marcos.id]: tokMarcos, [h.pessoas.milton.id]: tokMilton, [h.pessoas.mauro.id]: tokMauro };
    expect((await req('POST', `/ofertas/${oferta.id}/aceitar`, undefined, tokDe[oferta.pessoa_id])).status).toBe(200);
    const s = await A.solicitacaoDe(tel);

    // O painel da supervisão mostra quem está com a conversa e há quanto tempo o hóspede espera.
    const painel = await req('GET', `/dashboard?unidadeId=${h.unidadeId}`, undefined, tokMauro);
    const linha = painel.corpo.emAtendimento.find((x: { solicitacaoId: string }) => x.solicitacaoId === s.id);
    expect(linha).toMatchObject({ responsavel: { id: oferta.pessoa_id }, estado: 'em_atendimento' });
    expect(linha.esperandoRespostaSeg).not.toBeNull();

    // Recepção (outro setor) e um colega do mesmo nível não assumem.
    expect((await req('POST', `/solicitacoes/${s.id}/assumir`, undefined, tokRita)).status).toBe(403);
    const colega = oferta.pessoa_id === h.pessoas.marcos.id ? tokMilton : tokMarcos;
    expect((await req('POST', `/solicitacoes/${s.id}/assumir`, undefined, colega)).status).toBe(403);

    // O supervisor do setor assume.
    if (oferta.pessoa_id !== h.pessoas.mauro.id) {
      expect((await req('POST', `/solicitacoes/${s.id}/assumir`, undefined, tokMauro)).status).toBe(200);
      const depois = await A.solicitacaoDe(tel);
      expect(depois.responsavel_id).toBe(h.pessoas.mauro.id);
      expect(depois.responsavel_anterior_id).toBe(oferta.pessoa_id);
      expect(new Date(depois.atendente_desde).getTime()).toBeGreaterThan(new Date(s.atendente_desde).getTime());
      const [ev] = await A.consulta(`SELECT dados FROM evento WHERE solicitacao_id = $1 AND tipo = 'assumida'`, [s.id]);
      expect(ev.dados.de).toBe(oferta.pessoa_id);
      const notas = await A.consulta(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [s.id]);
      expect(notas.map((n: { texto: string }) => n.texto)).toContain('Mauro assumiu o atendimento.');
      // E responde ao hóspede na hora.
      expect((await req('POST', `/solicitacoes/${s.id}/mensagens`, { texto: 'Estou cuidando disso.', visibilidade: 'externa' }, tokMauro)).status).toBe(201);
    }
  }, 60_000);
});
