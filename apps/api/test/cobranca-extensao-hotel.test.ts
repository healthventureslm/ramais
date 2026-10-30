/**
 * Pagamento por link (Salabim Pay), mais noites na estadia e o chat do hotel:
 *  - o pedido do catálogo pela conversa pergunta como pagar; "2" manda o link, e o pago avisa todos;
 *  - a equipe manda um link para o que foi pedido na conta do quarto;
 *  - no quarto, "quero ficar mais 2 noites" cota, manda o link e, pago, a estadia aumenta;
 *  - o QR do hotel abre um chat de visitante (sem quarto) que reserva sem pedir identificação.
 * O Salabim, a VOA e a IA são simulados.
 */
import { randomUUID } from 'node:crypto';
import { dataLocal } from '@ramais/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

process.env.SALABIM_PAY_CHAVE = 'sk_test_simulada';
process.env.VOA_API_TOKEN = 'token-de-teste';

const dia = (n: number) => dataLocal(new Date(Date.now() + n * 86_400_000), 'America/Sao_Paulo');
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const nadaPedido = { sobreCatalogo: true, intencao: 'other', mostrar: [], adicionar: [], remover: [], data: null, hora: null, pessoas: null, sim: false, nao: false, naoTem: [], pagamento: null, modelo: 'teste' };
const nadaReserva = {
  querReservar: false,
  sobreReserva: false,
  desiste: false,
  estender: false,
  checkIn: null,
  checkOut: null,
  noites: null,
  quartos: null,
  adultos: null,
  criancas: null,
  idadesCriancas: [],
  escolha: null,
  nome: null,
  email: null,
  sim: false,
  modelo: 'teste',
};

describe.skipIf(!temBanco)('cobrança por link, mais noites e chat do hotel', () => {
  let A: Ambiente;
  let tokenQuarto: string;
  /** Links criados no "Salabim" e a situação de cada um (o teste muda para PAID). */
  const links = new Map<string, { status: string; valor: number; itens: unknown[]; reserva: unknown }>();
  let Cobrancas: unknown;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    const tokAdmin = await A.login(A.h.adminEmail);
    const item = (b: Record<string, unknown>) => A.req('POST', '/admin/catalogo', { unidadeId: A.h.unidadeId, ativo: true, ...b }, tokAdmin);
    await item({ setorId: A.h.setores.recepcao, categoria: 'Bebidas', tipo: 'compra', nome: 'Cerveja long neck', precoCentavos: 1600 });
    await item({ setorId: A.h.setores.recepcao, categoria: 'Bebidas', tipo: 'compra', nome: 'Água mineral', precoCentavos: 1000 });

    // @ts-ignore: módulos compilados
    const { IA } = await import('../dist/infra/tokens.js');
    // @ts-ignore
    const { ClienteSalabim } = await import('../dist/infra/salabim.js');
    // @ts-ignore
    const { ClienteVoa } = await import('../dist/infra/voa.js');
    // @ts-ignore
    Cobrancas = (await import('../dist/modules/cobrancas/cobrancas.service.js')).Cobrancas;

    // Salabim simulado nos dois processos (a IA cobra no worker; a equipe, pela api).
    for (const app of [A.api, A.worker]) {
      const sb = app.get(ClienteSalabim);
      sb.criarLink = async (p: { itens: { totalCentavos: number }[]; expiraEm: Date; reserva?: unknown }) => {
        const id = `pl_${randomUUID().replace(/-/g, '')}`;
        const valor = p.itens.reduce((s, i) => s + i.totalCentavos, 0);
        links.set(id, { status: 'ACTIVE', valor, itens: p.itens, reserva: p.reserva ?? null });
        return { id, url: `https://checkout.teste/pay/${id}`, estado: 'aguardando', status: 'ACTIVE', valorCentavos: valor, expiraEm: p.expiraEm.toISOString(), cobrancaProvedor: null };
      };
      sb.consultar = async (id: string) => {
        const l = links.get(id)!;
        const estado = { ACTIVE: 'aguardando', PAID: 'paga', EXPIRED: 'expirada' }[l.status] ?? 'aguardando';
        return { id, url: null, estado, status: l.status, valorCentavos: l.valor, expiraEm: null, cobrancaProvedor: 'ch_teste' };
      };
    }

    // A IA "lê" as frases do teste: pedido (c1 cerveja, c2 água) e reserva/extensão.
    A.worker.get(IA).pedido = {
      disponivel: true,
      extrair: async (texto: string) => {
        if (/duas cervejas/i.test(texto)) return { ...nadaPedido, intencao: 'add', adicionar: [{ codigo: 'c1', quantidade: 2, observacao: null }] };
        if (/uma [aá]gua/i.test(texto)) return { ...nadaPedido, intencao: 'add', adicionar: [{ codigo: 'c2', quantidade: 1, observacao: null }], naoTem: /vinho/.test(texto) ? ['vinho'] : [] };
        if (/só isso/i.test(texto)) return { ...nadaPedido, intencao: 'checkout', nao: true };
        if (/^\d$/.test(texto.trim())) return { ...nadaPedido, intencao: 'answer' };
        return { ...nadaPedido, sobreCatalogo: false };
      },
    };
    A.worker.get(IA).reserva = {
      disponivel: true,
      extrair: async (texto: string) => {
        if (/ficar mais 2 noites/i.test(texto)) return { ...nadaReserva, querReservar: true, sobreReserva: true, estender: true, noites: 2 };
        if (/aumento da minha reserva em 3 dias/i.test(texto)) return { ...nadaReserva, querReservar: true, sobreReserva: true, estender: true, noites: 3 };
        if (/Amanhã, dia X/.test(texto)) return { ...nadaReserva, sobreReserva: true, checkIn: dia(0), checkOut: dia(1) };
        if (/^Confirma$/.test(texto)) return { ...nadaReserva, sobreReserva: true, checkIn: dia(1), checkOut: dia(2), sim: true };
        if (/reservar um quarto/i.test(texto)) return { ...nadaReserva, querReservar: true, sobreReserva: true, checkIn: dia(20), checkOut: dia(22), adultos: 2, criancas: 0 };
        return { ...nadaReserva };
      },
    };
    const voa = A.worker.get(ClienteVoa);
    Object.defineProperty(voa, 'disponivel', { value: true });
    voa.buscar = async (_hotel: number, checkIn: string, checkOut: string) => ({
      ok: true,
      id: 'busca-1',
      expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      motivo: null,
      tarifas: [
        {
          quartoId: 332,
          quartoNome: 'Deluxe Casal',
          tarifaId: 86,
          tarifaNome: 'Motor de Reservas',
          regime: 'HOSTING_WITH_BREAKFAST',
          regimeNome: 'Com café da manhã',
          cancelavel: true,
          cancelamentoAte: null,
          cancelamentoTexto: null,
          noites: Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000),
          total: 735,
          diarias: 700,
          impostos: 35,
          foto: null,
        },
      ],
    });
    await A.consulta('UPDATE unidade SET voa_hotel_id = 81 WHERE id = $1', [A.h.unidadeId]);
    tokenQuarto = (await A.req('POST', '/chat/sessao', { codigo: A.h.codigoQr, idioma: 'pt-BR' })).corpo.token;
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const vistas = new Set<string>();
  /** Manda a fala pelo chat (do quarto ou do hotel) e espera a próxima resposta automática. */
  async function falar(token: string, texto: string): Promise<string> {
    await fetch(`${A.base}/chat/mensagens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat': token },
      body: JSON.stringify({ id: randomUUID(), texto }),
    });
    return proxima(token);
  }
  function proxima(token: string): Promise<string> {
    return A.esperar(async () => {
      const r = await fetch(`${A.base}/chat`, { headers: { 'x-chat': token } });
      const v = (await r.json()) as { mensagens: { id: string; autor: string; texto: string | null }[] };
      const nova = v.mensagens.find((m) => m.autor !== 'hospede' && !vistas.has(m.id));
      if (nova) vistas.add(nova.id);
      return nova?.texto?.replace(/ /g, ' ');
    });
  }
  /** O "Salabim" diz que foi pago e a conferência roda (no lugar do temporizador de 15 s). */
  async function pagar(linkId: string) {
    links.get(linkId)!.status = 'PAID';
    const [cob] = await A.consulta<{ id: string }>('SELECT id FROM cobranca WHERE link_id = $1', [linkId]);
    await (A.worker.get(Cobrancas) as { conferir: (o: string, id: string, t: number | null) => Promise<void> }).conferir(A.h.orgId, cob!.id, null);
  }
  const linkDe = (texto: string) => /https:\/\/checkout\.teste\/pay\/(pl_\w+)/.exec(texto)?.[1];

  it('pedido pela conversa: escolhe pagar agora, recebe o link e o pago avisa hóspede e equipe', async () => {
    expect(await falar(tokenQuarto, 'Me vê duas cervejas')).toContain('2× Cerveja long neck: R$ 32,00');
    const pergunta = await falar(tokenQuarto, 'só isso');
    expect(pergunta).toContain('Total: R$ 32,00.');
    expect(pergunta).toMatch(/Como prefere pagar\?\n1\. Na conta do quarto\n2\. Agora, por Pix ou cartão/);
    const pronto = await falar(tokenQuarto, '2');
    expect(pronto).toMatch(/^Pronto! Pedido enviado:/);
    expect(pronto).toContain('Pague por Pix ou cartão neste link');
    const id = linkDe(pronto)!;
    expect(links.get(id)!.valor).toBe(3200);

    // A equipe vê "aguardando pagamento" no cartão do pedido.
    const [p] = await A.consulta<{ id: string; solicitacao_id: string }>(`SELECT id, solicitacao_id FROM pedido WHERE cobranca_id IS NOT NULL AND unidade_id = $1`, [A.h.unidadeId]);
    const tokRita = await A.login(A.h.pessoas.rita.email);
    let card = await A.req('GET', `/pedidos/solicitacao/${p!.solicitacao_id}`, undefined, tokRita);
    expect(card.corpo.pedido.pagamento).toMatchObject({ estado: 'aguardando', valorCentavos: 3200 });

    await pagar(id);
    expect(await proxima(tokenQuarto)).toBe('Pagamento confirmado: pedido, quarto 302, R$ 32,00. Obrigado!');
    card = await A.req('GET', `/pedidos/solicitacao/${p!.solicitacao_id}`, undefined, tokRita);
    expect(card.corpo.pedido.pagamento.estado).toBe('paga');
    const notas = await A.consulta<{ texto: string }>(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [p!.solicitacao_id]);
    expect(notas.map((n) => n.texto).join('\n').replace(/ /g, ' ')).toContain('Pago pelo hóspede por link (Pix ou cartão): R$ 32,00. Não lançar na conta do quarto.');
    // Pago por link não vai para a conta do quarto.
    expect((await A.req('POST', `/pedidos/${p!.id}/lancar`, undefined, tokRita)).status).toBe(409);
  }, 90_000);

  it('na conta do quarto, a equipe manda depois um link para pagar', async () => {
    // O hotel não tem vinho: diz, em vez de trocar por outro item.
    expect(await falar(tokenQuarto, 'Quero uma água e um vinho')).toMatch(/^Não temos vinho no cardápio do hotel\.\n\nAnotado:\n• 1× Água mineral: R\$ 10,00/);
    await falar(tokenQuarto, 'só isso');
    expect(await falar(tokenQuarto, '1')).toContain('Total: R$ 10,00, na conta do quarto.');
    const [p] = await A.consulta<{ id: string }>(`SELECT id FROM pedido WHERE cobranca_id IS NULL AND item_nome = 'Água mineral' AND unidade_id = $1`, [A.h.unidadeId]);
    const tokRita = await A.login(A.h.pessoas.rita.email);
    const r = await A.req('POST', `/pedidos/${p!.id}/cobrar`, undefined, tokRita);
    expect(r.status).toBe(200);
    expect(r.corpo.link).toMatch(/^https:\/\/checkout\.teste\/pay\/pl_/);
    const msg = await proxima(tokenQuarto);
    expect(msg).toMatch(/^Total: R\$ 10,00\.\nPague por Pix ou cartão neste link/);
    // De novo não: o link está ativo.
    expect((await A.req('POST', `/pedidos/${p!.id}/cobrar`, undefined, tokRita)).status).toBe(409);
  }, 90_000);

  it('mais noites no quarto: cota, manda o link e, pago, a estadia vai até o novo check-out', async () => {
    const checkout = dia(2);
    const novo = dia(4);
    const cot = await falar(tokenQuarto, 'Quero ficar mais 2 noites');
    expect(cot).toBe(`Dá para ficar até ${dm(novo)}: 2 noites a mais (Deluxe Casal, com café da manhã) por R$ 735,00, com impostos.\nConfirmando, mando o link para pagar por Pix ou cartão.\n\nConfirma?`);
    const link = await falar(tokenQuarto, 'sim');
    expect(link).toMatch(new RegExp(`^Perfeito! 2 noites a mais, de ${dm(checkout)} a ${dm(novo)}, quarto 302\\. Total: R\\$ 735,00\\.`));
    const id = linkDe(link)!;
    expect(links.get(id)!.reserva).toMatchObject({ checkIn: checkout, checkOut: novo });

    await pagar(id);
    const ok = await proxima(tokenQuarto);
    expect(ok).toMatch(new RegExp(`^Pagamento confirmado! Sua estadia foi estendida: o check-out agora é em ${dm(novo)}, às 12h \\(2 noites a mais\\)\\. Código: VOA-EXT`));
    const [h] = await A.consulta<{ checkout: string }>('SELECT checkout::text FROM hospede_ativo WHERE local_id = $1', [A.h.localId]);
    expect(h!.checkout).toBe(novo);
    const [r] = await A.consulta<{ estado: string; tipo: string; extensao: { confirmacao: { status: string; simulated: boolean } } }>(
      `SELECT estado, tipo, extensao FROM reserva_hospedagem WHERE unidade_id = $1 AND tipo = 'extensao'`,
      [A.h.unidadeId],
    );
    expect(r).toMatchObject({ estado: 'paga', tipo: 'extensao', extensao: { confirmacao: { status: 'CONFIRMED', simulated: true } } });
  }, 90_000);

  it('minha conta: mostra o pago, o link em aberto e o que está na conta; "pagar agora" cobra o que está na conta', async () => {
    const conta = () => fetch(`${A.base}/chat/conta`, { headers: { 'x-chat': tokenQuarto } }).then((r) => r.json());
    let c = await conta();
    // Cervejas pagas por link, água com o link da equipe em aberto, noites a mais pagas.
    expect(c.itens.map((i: { tipo: string; situacao: string; valorCentavos: number }) => [i.tipo, i.situacao, i.valorCentavos])).toEqual([
      ['compra', 'pago', 3200],
      ['compra', 'aguardando', 1000],
      ['estadia', 'pago', 73500],
    ]);
    expect(c).toMatchObject({ pagoCentavos: 76700, abertoCentavos: 1000, aPagarCentavos: 0, pagamentoOnline: true });

    await falar(tokenQuarto, 'Quero uma água');
    await falar(tokenQuarto, 'só isso');
    await falar(tokenQuarto, '1');
    c = await conta();
    expect(c).toMatchObject({ abertoCentavos: 2000, aPagarCentavos: 1000 });
    const r = await fetch(`${A.base}/chat/conta/pagar`, { method: 'POST', headers: { 'x-chat': tokenQuarto } }).then((x) => x.json());
    expect(r).toMatchObject({ valorCentavos: 1000 });
    expect(await proxima(tokenQuarto)).toMatch(/^Sua conta: R\$ 10,00\.\nPague por Pix ou cartão neste link/);
    c = await conta();
    expect(c.aPagarCentavos).toBe(0);
    expect(c.itens.at(-1)).toMatchObject({ situacao: 'aguardando', link: r.link });
  }, 90_000);

  it('mais noites sem lista de hóspedes: "amanhã, dia X" é o check-out de hoje, e "Confirma" manda o link', async () => {
    await A.consulta('DELETE FROM hospede_ativo WHERE local_id = $1', [A.h.localId]);
    expect(await falar(tokenQuarto, 'Quero fazer um aumento da minha reserva em 3 dias')).toBe(
      'Claro! Qual é o dia do seu check-out hoje? Aí eu vejo as 3 noites a mais.',
    );
    // A IA leu "Amanhã, dia X" como hoje → amanhã; o pedido era 3 noites a partir do check-out.
    expect(await falar(tokenQuarto, 'Amanhã, dia X')).toMatch(new RegExp(`^Dá para ficar até ${dm(dia(4))}: 3 noites a mais`));
    // E reescreveu as datas junto com o "Confirma": vale o sim, sai o link.
    expect(await falar(tokenQuarto, 'Confirma')).toMatch(new RegExp(`^Perfeito! 3 noites a mais, de ${dm(dia(1))} a ${dm(dia(4))}`));
  }, 90_000);

  it('no meio de um atendimento com a equipe, pedir quarto com datas entra na reserva e a conversa fica com a equipe', async () => {
    const r = await fetch(`${A.base}/chat/setor`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-chat': tokenQuarto }, body: JSON.stringify({ chave: 'recepcao' }) });
    expect(r.status).toBe(200);
    await proxima(tokenQuarto); // "Pronto! Seu pedido foi encaminhado para Recepção…"
    // Um quarto com uma tarifa só: vai direto ao resumo.
    const resumo = await falar(tokenQuarto, 'Ok, quero reservar um quarto');
    expect(resumo).toMatch(/^Resumo da sua reserva:\n.*, 2 adultos/);
    const [s] = await A.consulta<{ id: string; estado: string; setor: string }>(
      `SELECT s.id, s.estado, st.chave AS setor FROM solicitacao s JOIN setor st ON st.id = s.setor_id JOIN reserva_hospedagem r ON r.solicitacao_id = s.id
        WHERE s.unidade_id = $1 AND r.tipo = 'nova' ORDER BY r.criado_em DESC LIMIT 1`,
      [A.h.unidadeId],
    );
    // A conversa continua na fila da recepção; a equipe vê que a IA assumiu a reserva.
    expect(s).toMatchObject({ setor: 'recepcao' });
    expect(['na_fila', 'oferecida']).toContain(s!.estado);
    const notas = await A.consulta<{ texto: string }>(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [s!.id]);
    expect(notas.map((n) => n.texto).join('\n')).toContain('O hóspede pediu uma reserva com datas no meio do atendimento: a IA assumiu');

    // A atendente responde: dali em diante a reserva é com ela, a IA para.
    const tokRita = await A.login(A.h.pessoas.rita.email);
    expect((await A.req('POST', `/solicitacoes/${s!.id}/pegar`, undefined, tokRita)).status).toBe(200);
    expect((await A.req('POST', `/solicitacoes/${s!.id}/mensagens`, { texto: 'Oi! Eu sigo com a sua reserva.', visibilidade: 'externa' }, tokRita)).status).toBe(201);
    await proxima(tokenQuarto);
    await fetch(`${A.base}/chat/mensagens`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-chat': tokenQuarto }, body: JSON.stringify({ id: randomUUID(), texto: '1' }) });
    const [parou] = await A.esperar(async () => {
      const x = await A.consulta<{ estado: string }>(`SELECT estado FROM reserva_hospedagem WHERE solicitacao_id = $1 AND estado = 'desistiu'`, [s!.id]);
      return x.length ? x : null;
    });
    expect(parou).toMatchObject({ estado: 'desistiu' });
    const depois = await A.consulta<{ autor_tipo: string; texto: string }>(
      `SELECT autor_tipo, texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'externa' ORDER BY criado_em DESC LIMIT 1`,
      [s!.id],
    );
    expect(depois[0]).toMatchObject({ autor_tipo: 'solicitante', texto: '1' });
  }, 90_000);

  it('QR do hotel: o visitante conversa sem quarto, cada sessão é uma conversa, e reserva sem identificação', async () => {
    const [u] = await A.consulta<{ codigo_publico: string }>('SELECT codigo_publico FROM unidade WHERE id = $1', [A.h.unidadeId]);
    expect((await A.req('POST', '/chat/hotel', { codigo: 'naoexiste123' })).status).toBe(404);
    const abre = await A.req('POST', '/chat/hotel', { codigo: u!.codigo_publico, idioma: 'pt-BR' });
    expect(abre.status).toBe(201);
    expect(abre.corpo).toMatchObject({ quarto: null, tipoLocal: 'hotel' });
    const tok = abre.corpo.token as string;
    const vista = await fetch(`${A.base}/chat`, { headers: { 'x-chat': tok } }).then((r) => r.json());
    expect(vista).toMatchObject({ quarto: null, setores: [], temCatalogo: false, mensagens: [] });
    // Sem quarto, não há catálogo nem pedido.
    expect((await fetch(`${A.base}/chat/catalogo`, { headers: { 'x-chat': tok } }).then((r) => r.json())).itens).toEqual([]);

    const resumo = await falar(tok, 'Quero reservar um quarto');
    expect(resumo).toMatch(/^Resumo da sua reserva:\n.*, 2 adultos/);
    expect(resumo).toContain('Deluxe Casal · Motor de Reservas');
    expect(resumo).toContain('Diárias: R$ 700,00\nImpostos (ISS): R$ 35,00\nTotal: R$ 735,00');
    const [s] = await A.consulta<{ nome: string; local_id: string | null; contexto: { visitante?: boolean } }>(
      `SELECT st.nome, s.local_id, s.contexto FROM solicitacao s JOIN solicitante st ON st.id = s.solicitante_id WHERE st.telefone LIKE 'visitante:%' AND s.unidade_id = $1`,
      [A.h.unidadeId],
    );
    expect(s).toMatchObject({ nome: 'Visitante (chat do hotel)', local_id: null, contexto: { visitante: true } });
    // "Visitante (chat do hotel)" é nome nosso: depois do resumo, pergunta o titular.
    expect(await proxima(tok)).toMatch(/^Para gerar o link de pagamento, me diga o nome completo do titular/);

    // Outro visitante não vê a conversa do primeiro.
    const outro = (await A.req('POST', '/chat/hotel', { codigo: u!.codigo_publico })).corpo.token as string;
    const dele = await fetch(`${A.base}/chat`, { headers: { 'x-chat': outro } }).then((r) => r.json());
    expect(dele.mensagens).toEqual([]);
  }, 90_000);
});
