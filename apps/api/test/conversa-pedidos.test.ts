/**
 * Pedido do catálogo conversando: o hóspede pergunta o que há, pede vários itens, marca um
 * horário, fecha ("só isso") e confirma; os itens do mesmo setor viram um atendimento só.
 * A IA é simulada (só a intenção e os códigos); respostas e valores saem do catálogo.
 */
import { randomUUID } from 'node:crypto';
import { dataLocal } from '@ramais/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

const amanha = dataLocal(new Date(Date.now() + 86_400_000), 'America/Sao_Paulo');
const nada = { sobreCatalogo: true, intencao: 'other', mostrar: [], adicionar: [], remover: [], data: null, hora: null, pessoas: null, sim: false, nao: false, naoTem: [], pagamento: null, modelo: 'teste' };

describe.skipIf(!temBanco)('pedido do catálogo pela conversa', () => {
  let A: Ambiente;
  let token: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    const tokAdmin = await A.login(A.h.adminEmail);
    const item = (b: Record<string, unknown>) => A.req('POST', '/admin/catalogo', { unidadeId: A.h.unidadeId, ativo: true, ...b }, tokAdmin);
    // Ordem de cadastro = códigos c1, c2, c3 (o catálogo sai por categoria e ordem).
    await item({ setorId: A.h.setores.recepcao, categoria: 'Bebidas', tipo: 'compra', nome: 'Cerveja long neck', precoCentavos: 1600 });
    await item({ setorId: A.h.setores.recepcao, categoria: 'Bebidas', tipo: 'compra', nome: 'Água mineral', precoCentavos: 1000 });
    await item({
      setorId: A.h.setores.governanca,
      categoria: 'Spa',
      tipo: 'agendamento',
      nome: 'Massagem relaxante',
      precoCentavos: 28000,
      duracaoMin: 60,
      capacidade: 1,
      vagasPor: 'pedido',
      horarios: [{ dias: [0, 1, 2, 3, 4, 5, 6], inicio: '10:00', fim: '13:00', intervaloMin: 60 }],
      antecedenciaMin: 0,
    });
    // @ts-ignore: módulo compilado
    const { IA } = await import('../dist/infra/tokens.js');
    // A IA "lê" as frases do teste (c1 cerveja, c2 água, c3 massagem).
    A.worker.get(IA).pedido = {
      disponivel: true,
      extrair: async (texto: string) => {
        if (/pra beber/i.test(texto)) return { ...nada, intencao: 'browse', mostrar: ['c1', 'c2'] };
        if (/duas cervejas/i.test(texto)) return { ...nada, intencao: 'add', adicionar: [{ codigo: 'c1', quantidade: 2, observacao: null }, { codigo: 'c2', quantidade: 1, observacao: 'sem gás' }] };
        if (/massagem/i.test(texto)) return { ...nada, intencao: 'add', adicionar: [{ codigo: 'c3', quantidade: 1, observacao: null }], data: amanha, pessoas: 1 };
        if (/às 11/i.test(texto)) return { ...nada, intencao: 'answer', hora: '11:00' };
        if (/só isso/i.test(texto)) return { ...nada, intencao: 'checkout', nao: true };
        if (/^sim/i.test(texto)) return { ...nada, intencao: 'confirm', sim: true };
        return { ...nada, sobreCatalogo: false };
      },
    };
    token = (await A.req('POST', '/chat/sessao', { codigo: A.h.codigoQr, idioma: 'pt-BR' })).corpo.token;
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const vistas = new Set<string>();
  /** Manda a fala e espera a próxima resposta automática nova. */
  async function falar(texto: string): Promise<string> {
    await fetch(`${A.base}/chat/mensagens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat': token },
      body: JSON.stringify({ id: randomUUID(), texto }),
    });
    return A.esperar(async () => {
      const r = await fetch(`${A.base}/chat`, { headers: { 'x-chat': token } });
      const v = (await r.json()) as { mensagens: { id: string; autor: string; texto: string | null }[] };
      const nova = v.mensagens.find((m) => m.autor !== 'hospede' && !vistas.has(m.id));
      if (nova) vistas.add(nova.id);
      return nova?.texto?.replace(/ /g, ' ');
    });
  }

  it('pergunta, monta o carrinho, marca o horário, fecha e confirma', async () => {
    expect(await falar('Boa noite! O que tem pra beber?')).toMatch(/Temos:\n• Cerveja long neck: R\$ 16,00\n• Água mineral: R\$ 10,00/);
    const anotado = await falar('Me vê duas cervejas e uma água');
    expect(anotado).toContain('2× Cerveja long neck: R$ 32,00');
    expect(anotado).toContain('1× Água mineral (sem gás): R$ 10,00');
    expect(anotado).toMatch(/Quer mais alguma coisa\?$/);
    expect(await falar('Quero uma massagem amanhã')).toMatch(/Massagem relaxante em .* tenho 10:00, 11:00, 12:00\. Qual horário prefere\?/);
    expect(await falar('às 11')).toMatch(/Massagem relaxante, .* às 11:00, 1 pessoa: R\$ 280,00/);
    // "Só isso" não encerra a conversa: fecha o pedido.
    const resumo = await falar('só isso');
    expect(resumo).toContain('Total: R$ 322,00, na conta do quarto.');
    expect(resumo).toMatch(/Confirma\?$/);
    expect(await falar('sim')).toMatch(/^Pronto! Pedido enviado:/);

    const grupos = await A.consulta<{ setor: string; itens: number; total: number }>(
      `SELECT st.chave AS setor, count(*)::int AS itens, sum(p.total_centavos)::int AS total
         FROM pedido p JOIN solicitacao s ON s.id = p.solicitacao_id JOIN setor st ON st.id = s.setor_id
        WHERE p.unidade_id = $1 GROUP BY st.chave ORDER BY st.chave`,
      [A.h.unidadeId],
    );
    expect(grupos).toEqual([
      { setor: 'governanca', itens: 1, total: 28000 },
      { setor: 'recepcao', itens: 2, total: 4200 },
    ]);
    // A equipe responde pelo grupo: uma confirmação vale para os dois itens.
    const tokRita = await A.login(A.h.pessoas.rita.email);
    const [p] = await A.consulta<{ id: string; solicitacao_id: string }>(
      `SELECT p.id, p.solicitacao_id FROM pedido p JOIN solicitacao s ON s.id = p.solicitacao_id JOIN setor st ON st.id = s.setor_id WHERE st.chave = 'recepcao' AND p.unidade_id = $1 LIMIT 1`,
      [A.h.unidadeId],
    );
    expect((await A.req('POST', `/pedidos/${p!.id}/confirmar`, undefined, tokRita)).status).toBe(200);
    const card = await A.req('GET', `/pedidos/solicitacao/${p!.solicitacao_id}`, undefined, tokRita);
    expect(card.corpo.pedidos.map((x: { estado: string }) => x.estado)).toEqual(['confirmado', 'confirmado']);
  }, 90_000);
});
