/**
 * Construtor de fluxo: o motor executa o fluxo configurado (boas-vindas, coleta que bloqueia,
 * condição por idioma com destino fixo, encerramento com pesquisa).
 */
import { configHotel } from '@ramais/vertical-hotel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

const fluxo = {
  entrada: [{ id: 'oi', tipo: 'mensagem', conteudo: { tipo: 'fixo', chave: 'boas_vindas' }, quando: [{ tipo: 'primeira_mensagem' }] }],
  identificacao: [
    {
      id: 'reserva',
      tipo: 'coletar',
      campo: 'reserva',
      pergunta: {
        tipo: 'livre',
        texto: { pt: 'Qual o código da sua reserva?', es: '¿Cuál es el código de su reserva?', en: 'What is your booking code?' },
      },
      bloqueia: true,
      tentativas: 2,
      seFalhar: 'humano',
      quando: [{ tipo: 'setor', setores: ['recepcao'] }],
    },
  ],
  resolucao: [
    { id: 'kb', tipo: 'base_conhecimento' },
    { id: 'decidir', tipo: 'decidir_setor', perguntarSeVago: true },
  ],
  atendimento: [
    { id: 'estrangeiro', tipo: 'encaminhar', destino: 'setor:concierge', avisar: true, quando: [{ tipo: 'idioma', idiomas: ['en'] }] },
    { id: 'normal', tipo: 'encaminhar', destino: 'decidido', avisar: true },
  ],
  encerramento: [
    { id: 'fim', tipo: 'mensagem', conteudo: { tipo: 'fixo', chave: 'resolvido' } },
    {
      id: 'nps',
      tipo: 'pesquisa',
      pergunta: { pt: 'De 1 a 5, como foi o atendimento?', es: 'Del 1 al 5, ¿cómo fue la atención?', en: 'From 1 to 5, how was the service?' },
      agradecimento: { pt: 'Obrigado pela nota!', es: '¡Gracias!', en: 'Thank you!' },
    },
  ],
};

describe.skipIf(!temBanco)('construtor de fluxo', () => {
  let A: Ambiente;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico', ajustes: { fluxo } });
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const textos = async (sid: string) => (await A.saidas(sid)).map((m) => m.texto);

  it('boas-vindas na primeira mensagem e coleta que bloqueia, com nova tentativa', async () => {
    const tel = '5521944440001';
    await A.hospede(tel, 'Meu cartão do quarto não abre a porta');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.contexto?.fluxo?.aguardando ? x : null;
    });
    expect(s.estado).toBe('automacao');
    await A.esperar(async () => (await textos(s.id)).some((t) => t.includes('código da sua reserva')));
    expect((await textos(s.id))[0]).toMatch(/Olá! Aqui é o atendimento/);

    await A.hospede(tel, 'não sei');
    await A.esperar(async () => (await textos(s.id)).some((t) => t.includes('e-mail de confirmação')));
    expect((await A.solicitacaoDe(tel)).estado).toBe('automacao');

    await A.hospede(tel, 'reserva ABC12345');
    const fim = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.estado === 'na_fila' ? x : null;
    });
    expect(fim.setor).toBe('recepcao');
    expect(fim.contexto.fluxo.dados.reserva).toBe('ABC12345');
    const notas = await A.consulta<{ texto: string }>(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [s.id]);
    expect(notas.map((n) => n.texto).join(' ')).toMatch(/código da reserva: ABC12345/);
  });

  it('coleta sem resposta válida passa para uma pessoa', async () => {
    const tel = '5521944440002';
    await A.hospede(tel, 'Quero mudar minha reserva');
    await A.esperar(async () => (await A.solicitacaoDe(tel))?.contexto?.fluxo?.aguardando);
    await A.hospede(tel, 'sei lá');
    await A.esperar(async () => (await A.solicitacaoDe(tel))?.contexto?.fluxo?.aguardando?.tentativas === 1);
    await A.hospede(tel, 'esqueci');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.estado === 'na_fila' ? x : null;
    });
    expect(s.setor).toBe('recepcao');
    await A.esperar(async () => (await textos(s.id)).some((t) => t.includes('pessoa da equipe')));
  });

  it('condição por idioma manda para um setor fixo', async () => {
    const tel = '14155550101';
    await A.hospede(tel, 'There is no hot water in the shower');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.estado === 'na_fila' ? x : null;
    });
    expect(s.setor).toBe('concierge');
    const evs = await A.consulta<{ dados: { trilha: { bloco: string; tipo: string; r: string }[] } }>(
      `SELECT dados FROM evento WHERE solicitacao_id = $1 AND tipo = 'fluxo' ORDER BY id`,
      [s.id],
    );
    const trilha = evs.flatMap((e) => e.dados.trilha);
    expect(trilha).toEqual(expect.arrayContaining([{ bloco: 'estrangeiro', tipo: 'encaminhar', r: 'seguir' }]));
  });

  it('encerramento com pesquisa: a nota não reabre o pedido', async () => {
    const tel = '5521944440003';
    await A.hospede(tel, 'A TV não liga');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.estado === 'na_fila' ? x : null;
    });
    const tok = await A.login(A.h.adminEmail);
    expect((await A.req('POST', `/solicitacoes/${s.id}/pegar`, undefined, tok)).status).toBe(200);
    expect((await A.req('POST', `/solicitacoes/${s.id}/resolver`, undefined, tok)).status).toBe(200);
    await A.esperar(async () => (await textos(s.id)).some((t) => t.includes('De 1 a 5')));
    await A.hospede(tel, '5');
    await A.esperar(async () => (await textos(s.id)).some((t) => t.includes('Obrigado pela nota')));
    const [ev] = await A.consulta<{ dados: { nota: number } }>(`SELECT dados FROM evento WHERE solicitacao_id = $1 AND tipo = 'pesquisa_respondida'`, [s.id]);
    expect(ev!.dados.nota).toBe(5);
    expect((await A.solicitacaoDe(tel)).estado).toBe('resolvida');
  });

  it('o fluxo é validado ao publicar: bloco fora da etapa e setor inexistente', async () => {
    const tok = await A.login(A.h.adminEmail);
    const ruim = {
      ...configHotel,
      fluxo: { ...fluxo, encerramento: [{ id: 'x', tipo: 'decidir_setor' }], atendimento: [{ id: 'y', tipo: 'encaminhar', destino: 'setor:spa' }] },
    };
    const r = await A.req('POST', '/admin/jornada/validar', { unidadeId: A.h.unidadeId, config: ruim }, tok);
    const msgs = r.corpo.erros.map((e: { erro: string }) => e.erro).join(' | ');
    expect(msgs).toMatch(/não cabe na etapa encerramento/);
    expect(msgs).toMatch(/setor inexistente: spa/);
  });
});
