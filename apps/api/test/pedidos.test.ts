/**
 * Catálogo e pedidos: o admin cadastra, o hóspede pede ou reserva pelo chat do quarto, o pedido
 * vira atendimento no setor do item, e a equipe confirma, recusa, lança na conta e conclui.
 */
import { dataLocal } from '@ramais/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('catálogo e pedidos', () => {
  let A: Ambiente;
  let tokAdmin: string;
  let tokRita: string;
  let token: string;
  let sanduiche: string;
  let massagem: string;
  const amanha = dataLocal(new Date(Date.now() + 86_400_000), 'America/Sao_Paulo');

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    tokAdmin = await A.login(A.h.adminEmail);
    tokRita = await A.login(A.h.pessoas.rita.email);
    token = (await A.req('POST', '/chat/sessao', { codigo: A.h.codigoQr, idioma: 'pt-BR' })).corpo.token;
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  async function chat(metodo: string, caminho: string, corpo?: unknown) {
    const r = await fetch(A.base + caminho, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-chat': token },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const t = await r.text();
    return { status: r.status, corpo: t ? JSON.parse(t) : null };
  }
  // A moeda vem com espaço não separável ("R$ 96,00"); compara com espaço comum.
  const sp = (t: string) => t.replace(/ /g, ' ');
  const textosDoChat = async () => ((await chat('GET', '/chat')).corpo.mensagens as { texto: string | null }[]).map((m) => sp(m.texto ?? ''));
  const solicitacao = async (id: string) => (await A.consulta('SELECT s.*, st.chave AS setor FROM solicitacao s JOIN setor st ON st.id = s.setor_id WHERE s.id = $1', [id]))[0];

  it('o admin cadastra; quem não é admin não', async () => {
    const base = { setorId: A.h.setores.recepcao, categoria: 'Room service', ativo: true };
    const s = await A.req('POST', '/admin/catalogo', { ...base, unidadeId: A.h.unidadeId, tipo: 'compra', nome: 'Club sandwich', precoCentavos: 4800, nomes: { en: 'Club sandwich' } }, tokAdmin);
    expect(s.status).toBe(201);
    sanduiche = s.corpo.id;
    const m = await A.req(
      'POST',
      '/admin/catalogo',
      {
        ...base,
        unidadeId: A.h.unidadeId,
        categoria: 'Spa',
        tipo: 'agendamento',
        nome: 'Massagem relaxante',
        precoCentavos: 25000,
        duracaoMin: 60,
        capacidade: 1,
        vagasPor: 'pedido',
        horarios: [{ dias: [0, 1, 2, 3, 4, 5, 6], inicio: '09:00', fim: '12:00', intervaloMin: 60 }],
        antecedenciaMin: 0,
      },
      tokAdmin,
    );
    expect(m.status).toBe(201);
    massagem = m.corpo.id;
    // Agendamento sem grade não passa.
    expect((await A.req('POST', '/admin/catalogo', { ...base, unidadeId: A.h.unidadeId, tipo: 'agendamento', nome: 'X', duracaoMin: 30 }, tokAdmin)).status).toBe(400);
    expect((await A.req('POST', '/admin/catalogo', { ...base, unidadeId: A.h.unidadeId, tipo: 'compra', nome: 'Y' }, tokRita)).status).toBe(403);
    expect((await A.req('GET', `/admin/catalogo?unidadeId=${A.h.unidadeId}`, undefined, tokAdmin)).corpo).toHaveLength(2);
  });

  it('o hóspede vê o catálogo e pede: vira atendimento no setor, com o aviso e a nota', async () => {
    const cat = await chat('GET', '/chat/catalogo');
    expect(cat.corpo.itens.map((i: { nome: string }) => i.nome).sort()).toEqual(['Club sandwich', 'Massagem relaxante']);

    const p = await chat('POST', '/chat/pedidos', { itemId: sanduiche, quantidade: 2, observacao: 'sem cebola' });
    expect(p.status).toBe(201);
    expect(p.corpo).toMatchObject({ estado: 'pendente', totalCentavos: 9600, quantidade: 2 });
    const s = await solicitacao(p.corpo.solicitacaoId);
    expect(s.setor).toBe('recepcao');
    expect(['na_fila', 'oferecida']).toContain(s.estado);
    expect(sp(s.resumo)).toBe('Pedido: 2× Club sandwich · total R$ 96,00');
    const nota = await A.consulta(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [s.id]);
    expect(nota[0].texto).toContain('Observação: sem cebola');
    await A.esperar(async () => (await textosDoChat()).some((t) => t.startsWith('Recebemos seu pedido: 2× Club sandwich. Total: R$ 96,00')));

    // A equipe confirma (e fica com o atendimento), lança na conta e conclui.
    expect((await A.req('POST', `/pedidos/${p.corpo.id}/confirmar`, undefined, tokRita)).status).toBe(200);
    expect(await solicitacao(s.id)).toMatchObject({ estado: 'em_atendimento', responsavel_id: A.h.pessoas.rita.id });
    expect((await A.req('POST', `/pedidos/${p.corpo.id}/confirmar`, undefined, tokRita)).status).toBe(409);
    await A.esperar(async () => (await textosDoChat()).some((t) => t.startsWith('Pedido confirmado: 2× Club sandwich')));
    await A.req('POST', `/pedidos/${p.corpo.id}/lancar`, undefined, tokRita);
    const card = await A.req('GET', `/pedidos/solicitacao/${s.id}`, undefined, tokRita);
    expect(card.corpo.pedido.lancadoEm).not.toBeNull();
    await A.req('POST', `/pedidos/${p.corpo.id}/concluir`, undefined, tokRita);
    expect((await solicitacao(s.id)).estado).toBe('resolvida');
    expect((await chat('GET', '/chat/pedidos')).corpo.pedidos[0]).toMatchObject({ estado: 'concluido' });
  }, 60_000);

  it('reserva: só horários livres, a última vaga não sai duas vezes, recusa e cancelamento avisam', async () => {
    const h = await chat('GET', `/chat/catalogo/${massagem}/horarios?data=${amanha}&pessoas=2`);
    expect(h.corpo.horarios.map((x: { hora: string }) => x.hora)).toEqual(['09:00', '10:00', '11:00']);

    const r1 = await chat('POST', '/chat/pedidos', { itemId: massagem, quantidade: 2, data: amanha, hora: '10:00' });
    expect(r1.status).toBe(201);
    expect(r1.corpo.totalCentavos).toBe(25000); // preço por sessão, não por pessoa
    expect((await chat('POST', '/chat/pedidos', { itemId: massagem, quantidade: 1, data: amanha, hora: '10:00' })).status).toBe(409);
    const depois = await chat('GET', `/chat/catalogo/${massagem}/horarios?data=${amanha}`);
    expect(depois.corpo.horarios.map((x: { hora: string }) => x.hora)).toEqual(['09:00', '11:00']);
    const agenda = await A.req('GET', `/pedidos?unidadeId=${A.h.unidadeId}&filtro=agenda`, undefined, tokRita);
    expect(agenda.corpo.pedidos.map((p: { id: string }) => p.id)).toEqual([r1.corpo.id]);

    // Recusa: o hóspede sabe o motivo, o atendimento encerra e o horário volta a ficar livre.
    expect((await A.req('POST', `/pedidos/${r1.corpo.id}/recusar`, { motivo: 'A massagista está de folga' }, tokRita)).status).toBe(200);
    expect((await solicitacao(r1.corpo.solicitacaoId)).estado).toBe('encerrada');
    await A.esperar(async () => (await textosDoChat()).some((t) => t.includes('A massagista está de folga')));
    expect((await chat('GET', `/chat/catalogo/${massagem}/horarios?data=${amanha}`)).corpo.horarios).toHaveLength(3);

    // O hóspede cancela uma reserva pendente.
    const r2 = await chat('POST', '/chat/pedidos', { itemId: massagem, quantidade: 1, data: amanha, hora: '09:00' });
    expect((await chat('POST', `/chat/pedidos/${r2.corpo.id}/cancelar`)).status).toBe(200);
    expect((await solicitacao(r2.corpo.solicitacaoId)).estado).toBe('cancelada');
    expect((await chat('POST', `/chat/pedidos/${r2.corpo.id}/cancelar`)).status).toBe(409);
  }, 60_000);
});
