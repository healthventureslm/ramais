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
        // A conversa do print: muita gente, idade de adulto, "cada" e a correção.
        if (/7 adultos e 7 crianças/i.test(texto)) return { ...vazia, querReservar: true, sobreReserva: true, checkIn: ENTRA, checkOut: SAI, adultos: 7, criancas: 7 };
        if (/^95 anos$/i.test(texto)) return { ...vazia, sobreReserva: true, idadesCriancas: [95] };
        if (/5 anos cada/i.test(texto)) return { ...vazia, sobreReserva: true, idadesCriancas: [5] };
        if (/nenhuma criança/i.test(texto)) return { ...vazia, sobreReserva: true, adultos: 2, criancas: 0 };
        if (/^quero outras datas$/i.test(texto)) return { ...vazia, sobreReserva: true, sim: true };
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
      // Mais de 4 pessoas num quarto: sem vaga.
      const gente = (quartos as { adultos: number; idadesCriancas: number[] }[]).reduce((n, q) => n + q.adultos + q.idadesCriancas.length, 0);
      if (gente > 4) return { ok: false, id: null, expira: null, motivo: null, tarifas: [] };
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
    // O resumo é uma mensagem só, que já termina pedindo nome e e-mail (como no bot da VOA).
    const resumo = await esperarSaida(tel, /Resumo da sua reserva/);
    expect(resumo).toMatch(/Total: R\$\s636,30\n\nPara gerar o link de pagamento, me envie seu nome completo e e-mail\.$/);
    expect((await cartoes(tel)).at(-1)).toMatchObject({ tipo: 'resumo', quarto: 'Deluxe Quadruplo', total: 636.3, trocarTarifa: true, trocarQuarto: true, pergunta: 'titular' });

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
    const link = await esperarSaida(tel, /^Sua reserva ainda não está garantida/);
    expect(link.replace(/ /g, ' ')).toContain('Deluxe Quadruplo\nTotal: R$ 636,30\n2 diárias, de');
    expect(link).toMatch(/Link válido por \d+ (minutos|horas), até \d{2}:\d{2}/);
    expect(link).toContain(`\n\nhttps://book.salabim.ai/central/checkout/${oferta(1)}\n\n`);
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
    // Só o nome: pede o e-mail uma vez; "sem e-mail" segue assim mesmo.
    await A.hospede(tel, 'João Teste Lima');
    await esperarSaida(tel, /^E qual e-mail para receber a confirmação da reserva/);
    await A.hospede(tel, 'sem e-mail');
    await esperarSaida(tel, /^Sua reserva ainda não está garantida/);
    expect(voa.ofertas.at(-1)).toMatchObject({ nome: 'João Teste Lima', email: null });
    const [r] = await A.consulta<{ id: string }>(`SELECT id FROM reserva_hospedagem WHERE solicitacao_id = $1`, [(await A.solicitacaoDe(tel)).id]);
    // @ts-ignore: módulos compilados
    const { Reservas } = await import('../dist/modules/reservas/reservas.service.js');
    const reservas = A.worker.get(Reservas) as { lembrarLink: (o: string, r: string, e: 'lembrete' | 'vence' | 'ultima' | 'expira') => Promise<void> };
    // Como no bot da VOA: três lembretes enquanto o link vale, o último com o botão de pagar.
    await reservas.lembrarLink(A.h.orgId, r!.id, 'lembrete');
    await esperarSaida(tel, /^Lembrete: o seu link de pagamento ainda está valendo/);
    await reservas.lembrarLink(A.h.orgId, r!.id, 'vence');
    await esperarSaida(tel, /^O seu link de pagamento vence às \d{2}:\d{2}/);
    await reservas.lembrarLink(A.h.orgId, r!.id, 'ultima');
    await esperarSaida(tel, /^Última chance: o seu link de pagamento vence às/);
    expect((await cartoes(tel)).at(-1)).toMatchObject({ tipo: 'pagamento', motivo: 'nova', quarto: 'Deluxe Triplo' });
    await reservas.lembrarLink(A.h.orgId, r!.id, 'expira');
    await esperarSaida(tel, /^O tempo para pagamento da sua cotação acabou.*nova reserva no Hotel Teste, me diga as datas/s);
    const notas = await A.consulta<{ texto: string }>(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [(await A.solicitacaoDe(tel)).id]);
    expect(notas.map((n) => n.texto).join('\n')).toContain('Vale a equipe de reservas procurar o hóspede');
    expect((await A.consulta('SELECT estado FROM reserva_hospedagem WHERE id = $1', [r!.id]))[0].estado).toBe('expirada');
    // O aviso da VOA depois não repete, e o temporizador de novo também não.
    const [o] = await A.consulta<{ oferta_uuid: string }>('SELECT oferta_uuid FROM reserva_hospedagem WHERE id = $1', [r!.id]);
    expect((await webhook({ event: 'payment.updated', checkout_uuid: o!.oferta_uuid, hotel_id: 81, status: 'EXPIRED' })).status).toBe(200);
    await reservas.lembrarLink(A.h.orgId, r!.id, 'expira');
    await new Promise((ok) => setTimeout(ok, 1500));
    expect((await saidas(tel)).filter((t) => /cotação acabou|expirou/.test(t)).length).toBe(1);
  }, 60_000);

  it('no WhatsApp: carrossel de quartos com foto, botões nas tarifas e no resumo, pagamento no botão', async () => {
    // @ts-ignore: módulos compilados
    const { ClienteMeta, ErroMeta } = await import('../dist/infra/meta.js');
    const meta = A.worker.get(ClienteMeta);
    const original = meta.enviarInterativo.bind(meta);
    const enviados: any[] = [];
    let recusar: string | null = null;
    meta.enviarInterativo = async (canal: unknown, para: string, i: any) => {
      enviados.push(i);
      if (i.type === recusar) throw new ErroMeta('(#131009) Parameter value is not valid', 400, true);
      return original(canal, para, i);
    };
    try {
      const tel = '5521977770005';
      await A.hospede(tel, 'Quero um quarto para mim');
      const carrossel = await A.esperar(async () => enviados.find((i) => i.type === 'carousel'));
      expect(carrossel.body.text).toMatch(/^Encontrei 2 opções de quarto .*com impostos\.\nDeslize e toque no quarto que preferir\.$/s);
      expect(carrossel.action.cards).toHaveLength(2);
      expect(carrossel.action.cards[0]).toMatchObject({
        card_index: 0,
        header: { type: 'image', image: { link: 'https://images.infra.voahoteis.io/quarto-333.jpg' } },
        action: { buttons: [{ type: 'quick_reply', quick_reply: { id: 'quarto_1|Deluxe Quadruplo', title: 'Ver tarifas' } }] },
      });
      expect(carrossel.action.cards[0].body.text.replace(/ /g, ' ')).toBe('Deluxe Quadruplo\nA partir de R$ 600,00\nCafé da manhã · Cancelamento grátis · 2 tarifas');
      // O triplo tem uma tarifa só: o botão é "Escolher" (mesmo tipo e número de botões em todos os cartões).
      expect(carrossel.action.cards[1].action.buttons[0].quick_reply.title).toBe('Escolher');

      // Toque no carrossel, como a Meta manda de verdade: `type: "button"`, o rótulo em `text` e o id
      // em `payload` (antes só o rótulo era lido e a escolha virava "Ver tarifas").
      await A.hospede(tel, { type: 'button', button: { payload: 'quarto_1|Deluxe Quadruplo', text: 'Ver tarifas' }, context: { from: '5521967219831', id: 'wamid.carrossel' } });
      const tarifas = await A.esperar(async () => enviados.find((i) => i.type === 'button' && i.action.buttons[0].reply.id.startsWith('tarifa_')));
      expect(tarifas.header).toEqual({ type: 'image', image: { link: 'https://images.infra.voahoteis.io/quarto-333.jpg' } });
      expect(tarifas.action.buttons.map((b: any) => b.reply.title)).toEqual(['1. Não reembolsável', '2. Flexível']);
      expect(tarifas.body.text.replace(/ /g, ' ')).toContain('2. Tarifa Flexível: R$ 636,30');

      await A.hospede(tel, { interactive: { type: 'button_reply', button_reply: { id: 'tarifa_2|Tarifa Flexível', title: '2. Flexível' } } });
      await esperarSaida(tel, /Resumo da sua reserva/);
      const doHospede = await A.consulta<{ texto: string }>(
        `SELECT m.texto FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id JOIN solicitante so ON so.id = s.solicitante_id
          WHERE so.telefone = $1 AND m.autor_tipo = 'solicitante' ORDER BY m.criado_em`,
        [tel],
      );
      // Os toques entram como se digitados (o horário do WhatsApp é em segundos: a ordem pode empatar).
      expect(doHospede.map((m) => m.texto).sort()).toEqual(['1. Deluxe Quadruplo', '2. Tarifa Flexível', 'Quero um quarto para mim']);
      const resumo = await A.esperar(async () => enviados.find((i) => i.type === 'button' && i.action.buttons.some((b: any) => b.reply.id === 'trocar_tarifa')));
      expect(resumo.header.image.link).toBe('https://images.infra.voahoteis.io/quarto-333.jpg');
      expect(resumo.action.buttons.map((b: any) => b.reply.title)).toEqual(['Trocar tarifa', 'Trocar quarto']);

      // "Trocar quarto" (botão do resumo) volta ao carrossel. Se a Meta recusar o carrossel, vai a lista.
      recusar = 'carousel';
      await A.hospede(tel, { interactive: { type: 'button_reply', button_reply: { id: 'trocar_quarto', title: 'Trocar quarto' } } });
      const lista = await A.esperar(async () => enviados.find((i) => i.type === 'list'));
      expect(lista.action.sections[0].rows[1]).toMatchObject({ id: 'quarto_2|Deluxe Triplo', title: '2. Deluxe Triplo' });
      recusar = null;
      await A.hospede(tel, { interactive: { type: 'list_reply', list_reply: { id: 'quarto_2|Deluxe Triplo', title: '2. Deluxe Triplo', description: '' } } });
      await A.esperar(async () => ((await saidas(tel)).filter((t) => t.startsWith('Resumo da sua reserva')).length === 2 ? true : null));

      // O perfil do WhatsApp tem nome, mas o titular é sempre perguntado (vem no fim do resumo).
      expect((await saidas(tel)).at(-1)).toMatch(/me envie seu nome completo e e-mail\.$/);
      await A.hospede(tel, 'João Teste Lima, joao@exemplo.com');
      const pagar = await A.esperar(async () => enviados.find((i) => i.type === 'cta_url'));
      expect(pagar.header).toEqual({ type: 'text', text: 'Link de pagamento' });
      expect(pagar.action).toMatchObject({ name: 'cta_url', parameters: { display_text: 'Pagar agora' } });
      expect(pagar.action.parameters.url).toMatch(/^https:\/\/book\.salabim\.ai\/central\/checkout\//);
      expect(pagar.body.text).not.toContain('book.salabim.ai');
    } finally {
      meta.enviarInterativo = original;
    }
  }, 90_000);

  it('idade de adulto conta como adulto, "cada" vale para todas, a correção apaga as crianças e as datas ficam', async () => {
    const tel = '5521977770006';
    await A.hospede(tel, 'Quero reservar para 7 adultos e 7 crianças');
    await esperarSaida(tel, /Qual a idade de cada criança/);
    await A.hospede(tel, '95 anos');
    await esperarSaida(tel, /^Com 95 anos conta como adulto: ficam 8 adultos, 6 crianças\.$/);
    await A.hospede(tel, '5 anos cada');
    const semVaga = await esperarSaida(tel, /^Não encontrei disponibilidade/);
    expect(semVaga).toContain('para 8 adultos, 6 crianças');
    expect(voa.buscas.at(-1)).toMatchObject({ quartos: [{ adultos: 8, idadesCriancas: [5, 5, 5, 5, 5, 5] }] });

    // "Na verdade são 2 adultos e nenhuma criança": as idades somem e busca de novo nas mesmas datas.
    await A.hospede(tel, 'ta entao na verdade são 2 adultos apenas, e nenhuma criança');
    await esperarSaida(tel, /^Encontrei 2 opções de quarto .* para 2 adultos\./);
    expect(voa.buscas.at(-1)).toMatchObject({ checkIn: ENTRA, checkOut: SAI, quartos: [{ adultos: 2, idadesCriancas: [] }] });
    expect((await saidas(tel)).some((t) => t.startsWith('Claro! Para quais datas'))).toBe(false);
  }, 60_000);

  it('sem vaga e o hóspede quer outras datas: pergunta as datas em vez de buscar as mesmas de novo', async () => {
    const tel = '5521977770007';
    await A.hospede(tel, 'Quero reservar para 7 adultos e 7 crianças');
    await esperarSaida(tel, /Qual a idade de cada criança/);
    await A.hospede(tel, '5 anos cada');
    await esperarSaida(tel, /^Não encontrei disponibilidade/);
    const buscas = voa.buscas.length;
    await A.hospede(tel, 'quero outras datas');
    await esperarSaida(tel, /^Quais outras datas você quer tentar/);
    expect(voa.buscas.length).toBe(buscas);
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
