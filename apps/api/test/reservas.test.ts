/**
 * Reserva de hospedagem automática (VOA): o hóspede pede pelo WhatsApp, a IA pergunta o que falta,
 * mostra as opções, gera o link de pagamento e avisa quando o webhook confirma. A VOA e a IA são
 * simuladas; o formato segue a documentação de parceiros da VOA.
 */
import { dataLocal } from '@ramais/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

const SEGREDO = 'Bearer segredo-de-teste-da-voa';
process.env.VOA_WEBHOOK_SEGREDO = SEGREDO;
process.env.VOA_API_TOKEN = 'token-de-teste';

const dia = (n: number) => dataLocal(new Date(Date.now() + n * 86_400_000), 'America/Sao_Paulo');
// O código da oferta é único na VOA (e no banco, que guarda as execuções anteriores).
const RODADA = Date.now().toString(36).toUpperCase();
const oferta = (n: number) => `VOA-T${RODADA}-${n}`;
const ENTRA = dia(10);
const SAI = dia(12);

const vazia = {
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
  modelo: 'teste',
};

describe.skipIf(!temBanco)('reserva de hospedagem automática', () => {
  let A: Ambiente;
  let voa: { buscas: unknown[]; ofertas: Record<string, unknown>[]; falhar: boolean };

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    // @ts-ignore: módulos compilados
    const { IA } = await import('../dist/infra/tokens.js');
    // @ts-ignore
    const { ClienteVoa } = await import('../dist/infra/voa.js');
    // A IA de reserva "lê" as frases do teste.
    A.worker.get(IA).reserva = {
      disponivel: true,
      extrair: async (texto: string) => {
        if (/reservar um quarto/i.test(texto)) return { ...vazia, querReservar: true, sobreReserva: true, checkIn: ENTRA, checkOut: SAI };
        if (/2 adultos/i.test(texto)) return { ...vazia, sobreReserva: true, adultos: 2, criancas: 0 };
        if (/deixa pra l/i.test(texto)) return { ...vazia, sobreReserva: true, desiste: true };
        if (/quero um quarto/i.test(texto)) return { ...vazia, querReservar: true, sobreReserva: true, checkIn: ENTRA, checkOut: SAI, adultos: 1 };
        return { ...vazia };
      },
    };
    voa = { buscas: [], ofertas: [], falhar: false };
    const cliente = A.worker.get(ClienteVoa);
    Object.defineProperty(cliente, 'disponivel', { value: true });
    cliente.buscar = async (_hotel: number, checkIn: string, checkOut: string, quartos: unknown) => {
      if (voa.falhar) throw new Error('VOA 500: we had a problem. Try again');
      voa.buscas.push({ checkIn, checkOut, quartos });
      const t = (quartoId: number, quartoNome: string, total: number, tarifaId = 86, tarifaNome = 'Tarifa Flexível', cancelavel = true) => ({
        quartoId,
        quartoNome,
        tarifaId,
        tarifaNome,
        regime: 'HOSTING_WITH_BREAKFAST',
        regimeNome: 'Com café da manhã',
        cancelavel,
        cancelamentoAte: cancelavel ? dia(3) : null,
        cancelamentoTexto: null,
        noites: 2,
        total,
        diarias: Math.round((total / 1.05) * 100) / 100,
        impostos: Math.round((total - total / 1.05) * 100) / 100,
        foto: `https://images.infra.voahoteis.io/quarto-${quartoId}.jpg`,
      });
      // Em ordem de preço, como a VOA devolve: o quadruplo tem duas tarifas.
      return {
        ok: true,
        id: 'busca-1',
        expira: new Date(Date.now() + 30 * 60_000).toISOString(),
        motivo: null,
        tarifas: [t(333, 'Deluxe Quadruplo', 600, 90, 'Tarifa Não Reembolsável', false), t(333, 'Deluxe Quadruplo', 636.3), t(332, 'Deluxe Triplo', 722.4)],
      };
    };
    cliente.criarOferta = async (p: Record<string, unknown>) => {
      voa.ofertas.push(p);
      return { id: 1, uuid: oferta(voa.ofertas.length), total: 636.3, expira: new Date(Date.now() + 2 * 3600_000).toISOString(), bookingId: '81-PRE-X', link: `https://book.salabim.ai/central/checkout/${oferta(voa.ofertas.length)}` };
    };
    await A.consulta('UPDATE unidade SET voa_hotel_id = 81 WHERE id = $1', [A.h.unidadeId]);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  // Todas as mensagens que saíram para este telefone (a reserva pode estar num atendimento novo).
  const saidas = async (tel: string) =>
    (
      await A.consulta<{ texto: string }>(
        `SELECT m.texto FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id JOIN solicitante so ON so.id = s.solicitante_id
          WHERE so.telefone = $1 AND m.visibilidade = 'externa' AND m.autor_tipo <> 'solicitante' ORDER BY m.criado_em`,
        [tel],
      )
    ).map((m) => m.texto);
  const esperarSaida = (tel: string, re: RegExp) => A.esperar(async () => (await saidas(tel)).find((t) => re.test(t)));
  const webhook = (corpo: unknown, auth = SEGREDO) =>
    fetch(`${A.base}/webhooks/voa`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(corpo) });

  // Os cartões que acompanharam as mensagens (quartos, tarifas, resumo, pagamento).
  const cartoes = async (tel: string) =>
    (
      await A.consulta<{ cartao: { tipo: string } & Record<string, unknown> }>(
        `SELECT m.cartao FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id JOIN solicitante so ON so.id = s.solicitante_id
          WHERE so.telefone = $1 AND m.cartao IS NOT NULL ORDER BY m.criado_em`,
        [tel],
      )
    ).map((m) => m.cartao);

  it('mostra os quartos, depois as tarifas e o resumo, gera o link e confirma o pagamento', async () => {
    const tel = '5521977770001';
    await A.hospede(tel, 'Olá, queria reservar um quarto');
    await esperarSaida(tel, /Quantos adultos e quantas crianças/);
    await A.hospede(tel, 'Somos 2 adultos');
    const opcoes = await esperarSaida(tel, /Encontrei 2 opções de quarto/);
    expect(opcoes).toContain('1. Deluxe Quadruplo: a partir de R$');
    expect(opcoes).toContain('2 tarifas, com café da manhã, opção com cancelamento grátis');
    expect(voa.buscas.at(-1)).toMatchObject({ checkIn: ENTRA, checkOut: SAI, quartos: [{ adultos: 2, idadesCriancas: [] }] });
    expect((await cartoes(tel))[0]).toMatchObject({
      tipo: 'quartos',
      noites: 2,
      adultos: 2,
      opcoes: [
        { n: 1, nome: 'Deluxe Quadruplo', aPartirDe: 600, tarifas: 2, cafe: true, cancelamentoGratis: true, foto: 'https://images.infra.voahoteis.io/quarto-333.jpg' },
        { n: 2, nome: 'Deluxe Triplo', tarifas: 1 },
      ],
    });

    // O botão do cartão manda "1. Deluxe Quadruplo": vale o número.
    await A.hospede(tel, '1. Deluxe Quadruplo');
    const tarifas = await esperarSaida(tel, /Qual tarifa você prefere/);
    expect(tarifas).toContain('1. Tarifa Não Reembolsável: R$');
    expect((await cartoes(tel)).at(-1)).toMatchObject({ tipo: 'tarifas', quarto: 'Deluxe Quadruplo', tarifas: [{ n: 1, cancelavel: false }, { n: 2, cancelavel: true, total: 636.3 }] });

    await A.hospede(tel, '2. Tarifa Flexível');
    await esperarSaida(tel, /Resumo da sua reserva/);
    await esperarSaida(tel, /nome completo do titular/);
    expect((await cartoes(tel)).at(-1)).toMatchObject({ tipo: 'resumo', quarto: 'Deluxe Quadruplo', total: 636.3, trocarTarifa: true, trocarQuarto: true });

    // "Trocar tarifa" volta às tarifas do mesmo quarto; a outra escolha refaz o resumo.
    await A.hospede(tel, 'Trocar tarifa');
    await A.esperar(async () => ((await cartoes(tel)).at(-1)?.tipo === 'tarifas' ? true : null));
    await A.hospede(tel, '1');
    await A.esperar(async () => ((await cartoes(tel)).at(-1)?.tipo === 'resumo' ? true : null));
    expect((await cartoes(tel)).at(-1)).toMatchObject({ tipo: 'resumo', total: 600, tarifa: { nome: 'Tarifa Não Reembolsável' } });
    // E de volta à Flexível, para o resto do teste.
    await A.hospede(tel, 'Trocar tarifa');
    await A.esperar(async () => ((await cartoes(tel)).at(-1)?.tipo === 'tarifas' ? true : null));
    await A.hospede(tel, '2');
    await A.esperar(async () => ((await cartoes(tel)).at(-1)?.tipo === 'resumo' && (await cartoes(tel)).filter((x) => x.tipo === 'resumo').length === 3 ? true : null));

    await A.hospede(tel, 'Maria Teste da Silva, maria@exemplo.com');
    const link = await esperarSaida(tel, /Pague por este link/);
    expect(link).toContain(`https://book.salabim.ai/central/checkout/${oferta(1)}`);
    expect(voa.ofertas[0]).toMatchObject({ quartoId: 333, tarifaId: 86, nome: 'Maria Teste da Silva', email: 'maria@exemplo.com', telefone: `+${tel}` });
    expect((await cartoes(tel)).at(-1)).toMatchObject({ tipo: 'pagamento', motivo: 'nova', quarto: 'Deluxe Quadruplo', noites: 2, link: `https://book.salabim.ai/central/checkout/${oferta(1)}` });
    const s = await A.solicitacaoDe(tel);
    expect(s.estado).toBe('resolvida');
    expect(s.resumo).toMatch(/aguardando pagamento/);

    // Webhook: sem o segredo, não; com ele, avisa o hóspede uma vez só.
    const pago = { event: 'payment.updated', checkout_uuid: oferta(1), hotel_id: 81, status: 'PAID', booking_status: 'CONFIRMED', booking_id: 'VOA-ABC123', total: 636.3 };
    expect((await webhook(pago, 'Bearer outro')).status).toBe(401);
    expect((await webhook(pago)).status).toBe(200);
    expect(await (await webhook(pago)).json()).toMatchObject({ repetido: true });
    await esperarSaida(tel, /Pagamento confirmado! Sua reserva está garantida.*VOA-ABC123/s);
    const [r] = await A.consulta('SELECT estado, booking_id FROM reserva_hospedagem WHERE oferta_uuid = $1', [oferta(1)]);
    expect(r).toEqual({ estado: 'paga', booking_id: 'VOA-ABC123' });
    expect((await saidas(tel)).filter((t) => t.startsWith('Pagamento confirmado')).length).toBe(1);
  }, 60_000);

  it('lembra do link antes de vencer e avisa quando vence sem pagamento', async () => {
    const tel = '5521977770004';
    await A.hospede(tel, 'Quero um quarto para mim');
    await esperarSaida(tel, /Encontrei 2 opções de quarto/);
    // O triplo tem uma tarifa só: escolher o quarto já é escolher a tarifa.
    await A.hospede(tel, '2');
    await esperarSaida(tel, /Resumo da sua reserva/);
    await A.hospede(tel, 'João Teste Lima');
    await esperarSaida(tel, /Pague por este link/);
    const [r] = await A.consulta<{ id: string }>(`SELECT id FROM reserva_hospedagem WHERE solicitacao_id = $1`, [(await A.solicitacaoDe(tel)).id]);
    // @ts-ignore: módulos compilados
    const { Reservas } = await import('../dist/modules/reservas/reservas.service.js');
    const reservas = A.worker.get(Reservas) as { lembrarLink: (o: string, r: string, e: 'lembrete' | 'expira') => Promise<void> };
    await reservas.lembrarLink(A.h.orgId, r!.id, 'lembrete');
    await esperarSaida(tel, /Lembrete: o seu link de pagamento vale até/);
    await reservas.lembrarLink(A.h.orgId, r!.id, 'expira');
    await esperarSaida(tel, /O link de pagamento venceu e a reserva não foi feita/);
    expect((await A.consulta('SELECT estado FROM reserva_hospedagem WHERE id = $1', [r!.id]))[0].estado).toBe('expirada');
    // O aviso da VOA depois não repete, e o temporizador de novo também não.
    const [o] = await A.consulta<{ oferta_uuid: string }>('SELECT oferta_uuid FROM reserva_hospedagem WHERE id = $1', [r!.id]);
    expect((await webhook({ event: 'payment.updated', checkout_uuid: o!.oferta_uuid, hotel_id: 81, status: 'EXPIRED' })).status).toBe(200);
    await reservas.lembrarLink(A.h.orgId, r!.id, 'expira');
    await new Promise((ok) => setTimeout(ok, 1500));
    expect((await saidas(tel)).filter((t) => /venceu|expirou/.test(t)).length).toBe(1);
  }, 60_000);

  it('o hóspede desiste; a VOA fora do ar passa o pedido para a recepção', async () => {
    const tel = '5521977770002';
    await A.hospede(tel, 'Quero reservar um quarto');
    await esperarSaida(tel, /Quantos adultos/);
    await A.hospede(tel, 'deixa pra lá');
    await esperarSaida(tel, /deixei a reserva de lado/);
    expect((await A.consulta('SELECT estado FROM reserva_hospedagem WHERE solicitacao_id = $1', [(await A.solicitacaoDe(tel)).id]))[0].estado).toBe('desistiu');

    const tel2 = '5521977770003';
    voa.falhar = true;
    await A.hospede(tel2, 'Quero um quarto para mim');
    await esperarSaida(tel2, /Vou passar o seu pedido para a recepção/);
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel2);
      return x.setor === 'recepcao' ? x : null;
    });
    expect(['na_fila', 'oferecida']).toContain(s.estado);
    voa.falhar = false;
  }, 60_000);
});
