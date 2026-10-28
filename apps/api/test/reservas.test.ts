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
      const t = (quartoId: number, quartoNome: string, total: number) => ({
        quartoId,
        quartoNome,
        tarifaId: 86,
        tarifaNome: 'Motor de Reservas',
        regime: 'HOSTING_WITH_BREAKFAST',
        regimeNome: 'Com café da manhã',
        cancelavel: true,
        cancelamentoAte: dia(3),
        cancelamentoTexto: null,
        noites: 2,
        total,
      });
      return { ok: true, id: 'busca-1', expira: new Date(Date.now() + 30 * 60_000).toISOString(), motivo: null, tarifas: [t(333, 'Deluxe Quadruplo', 636.3), t(332, 'Deluxe Triplo', 722.4)] };
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

  it('pede o que falta, mostra as opções, gera o link e confirma o pagamento', async () => {
    const tel = '5521977770001';
    await A.hospede(tel, 'Olá, queria reservar um quarto');
    await esperarSaida(tel, /Quantos adultos e quantas crianças/);
    await A.hospede(tel, 'Somos 2 adultos');
    const opcoes = await esperarSaida(tel, /Encontrei estas opções/);
    expect(opcoes).toContain('1. Deluxe Quadruplo, com café da manhã: R$');
    expect(voa.buscas.at(-1)).toMatchObject({ checkIn: ENTRA, checkOut: SAI, quartos: [{ adultos: 2, idadesCriancas: [] }] });

    await A.hospede(tel, '1');
    await esperarSaida(tel, /qual o nome completo do titular/);
    await A.hospede(tel, 'Maria Teste da Silva, maria@exemplo.com');
    const link = await esperarSaida(tel, /Pague por este link/);
    expect(link).toContain(`https://book.salabim.ai/central/checkout/${oferta(1)}`);
    expect(voa.ofertas[0]).toMatchObject({ quartoId: 333, tarifaId: 86, nome: 'Maria Teste da Silva', email: 'maria@exemplo.com', telefone: `+${tel}` });
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
