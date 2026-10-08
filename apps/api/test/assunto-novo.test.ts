/**
 * Assunto novo no meio de um atendimento: a base responde na hora sem incomodar quem atende, e um
 * pedido de outro setor abre um atendimento à parte. A conversa segue com quem já atende até ele
 * terminar; só então o paralelo passa a receber as mensagens.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

const TEL = '5521977770009';

describe.skipIf(!temBanco)('assunto novo no meio do atendimento', () => {
  let A: Ambiente;
  let tokMarcos: string;
  let origemId: string;
  // O que o roteador "fingido" responde para a próxima mensagem.
  let proximo: { assuntoNovo: boolean; confianca: number; setor: string; setorErrado?: boolean } = { assuntoNovo: false, confianca: 0.9, setor: 'vago' };

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    const { h, req, login } = A;
    tokMarcos = await login(h.pessoas.marcos.email);
    await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, tokMarcos);

    // Um pedido da manutenção, aceito pelo Marcos (roteamento por regras, como nos outros testes).
    await A.hospede(TEL, 'A lâmpada do banheiro queimou');
    const oferta = await A.esperar(async () => {
      const s = await A.solicitacaoDe(TEL);
      if (!s) return null;
      return (await A.consulta(`SELECT id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [s.id]))[0];
    });
    expect((await req('POST', `/ofertas/${oferta.id}/aceitar`, undefined, tokMarcos)).status).toBe(200);
    origemId = (await A.solicitacaoDe(TEL)).id;

    // Daqui em diante, a IA é fingida: o roteador responde `proximo`, a base só sabe do Wi-Fi.
    // @ts-ignore: módulo compilado
    const { IA } = await import('../dist/infra/tokens.js');
    const ia = A.worker.get(IA);
    const flag = (v: boolean) => v;
    ia.roteador = () => ({
      nome: 'teste',
      rotear: async () => ({
        saida: {
          setor: proximo.setor,
          urgencia: 'rotina',
          emergencia: flag(false),
          pede_humano: false,
          quer_encerrar: false,
          setor_errado: proximo.setorErrado ?? false,
          reclama_demora: false,
          insatisfeito: false,
          assunto_novo: proximo.assuntoNovo,
          idioma: 'pt',
        },
        confianca: {
          setor: 0.95,
          urgencia: 0.9,
          idioma: 0.9,
          emergencia: 0.05,
          pede_humano: 0.05,
          quer_encerrar: 0.05,
          setor_errado: proximo.setorErrado ? 0.9 : 0.05,
          reclama_demora: 0.05,
          insatisfeito: 0.05,
          assunto_novo: proximo.confianca,
        },
        motor: 'teste',
        latenciaMs: 1,
        metodoConfianca: 'nativa',
        perguntas: [],
      }),
    });
    ia.respondedor = {
      responder: async (pergunta: string) =>
        /wi-?fi/i.test(pergunta)
          ? { responde: true, resposta: 'A rede é Hotel-Hospedes; a senha está no cartão do quarto.', fontes: ['wifi'], confianca: 0.95, modelo: 'teste' }
          : { responde: false, resposta: null, fontes: [], confianca: 0.2, modelo: 'teste' },
    };
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const solicitacoes = () =>
    A.consulta<{ id: string; estado: string; setor: string | null; paralela_de: string | null }>(
      `SELECT s.id, s.estado, st.chave AS setor, s.contexto->>'paralelaDe' AS paralela_de
         FROM solicitacao s JOIN solicitante so ON so.id = s.solicitante_id LEFT JOIN setor st ON st.id = s.setor_id
        WHERE so.telefone = $1 ORDER BY s.criado_em`,
      [TEL],
    );
  const ondeFoi = (texto: string) =>
    A.esperar(async () => (await A.consulta<{ solicitacao_id: string }>(`SELECT solicitacao_id FROM mensagem WHERE texto = $1`, [texto]))[0]);

  it('pergunta da base no meio do atendimento: a IA responde e o atendimento não muda', async () => {
    // O roteador real chegou a marcar isto também como "setor errado" e transferia a manutenção
    // para a recepção. Assunto novo prevalece: nada é transferido.
    proximo = { assuntoNovo: true, confianca: 0.9, setor: 'recepcao', setorErrado: true };
    await A.hospede(TEL, 'Ah, e qual a senha do Wi-Fi?');
    const r = await A.esperar(async () => (await A.saidas(origemId)).find((m) => m.autor_tipo === 'ia' && m.texto.includes('Hotel-Hospedes')));
    expect(r).toBeTruthy();
    const s = await solicitacoes();
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: origemId, estado: 'em_atendimento', setor: 'manutencao' });
  });

  it('pedido de outro setor abre um atendimento paralelo, já encaminhado, e avisa quem atende', async () => {
    proximo = { assuntoNovo: true, confianca: 0.9, setor: 'governanca' };
    await A.hospede(TEL, 'Pode mandar duas toalhas também?');
    const paralela = await A.esperar(async () => (await solicitacoes()).find((x) => x.paralela_de === origemId && x.setor));
    expect(paralela).toMatchObject({ setor: 'governanca' });
    expect(['na_fila', 'oferecida']).toContain(paralela.estado);
    // O hóspede é avisado do encaminhamento; quem atende a manutenção, por nota interna.
    expect((await A.saidas(paralela.id)).some((m) => m.autor_tipo === 'sistema')).toBe(true);
    // A fala do hóspede vai para o paralelo: a governança vê o pedido como mensagem do hóspede.
    expect((await ondeFoi('Pode mandar duas toalhas também?')).solicitacao_id).toBe(paralela.id);
    const notas = await A.consulta<{ texto: string }>(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [origemId]);
    expect(notas.some((n) => n.texto.includes('toalhas') && n.texto.includes('atendimento separado'))).toBe(true);
    const notaParalela = await A.consulta<{ texto: string }>(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [paralela.id]);
    expect(notaParalela.some((n) => n.texto.includes('durante o atendimento de'))).toBe(true);
    // A manutenção segue intacta.
    expect((await solicitacoes()).find((x) => x.id === origemId)).toMatchObject({ estado: 'em_atendimento', setor: 'manutencao' });
  });

  it('a conversa continua com quem já atende: a próxima mensagem vai para a manutenção', async () => {
    proximo = { assuntoNovo: false, confianca: 0.9, setor: 'vago' };
    await A.hospede(TEL, 'A lâmpada ainda está piscando');
    expect((await ondeFoi('A lâmpada ainda está piscando')).solicitacao_id).toBe(origemId);
  });

  it('com confiança baixa em "assunto novo", nada muda: vai para quem atende', async () => {
    proximo = { assuntoNovo: true, confianca: 0.4, setor: 'alimentos_bebidas' };
    const antes = (await solicitacoes()).length;
    await A.hospede(TEL, 'Vocês têm cardápio?');
    expect((await ondeFoi('Vocês têm cardápio?')).solicitacao_id).toBe(origemId);
    expect(await solicitacoes()).toHaveLength(antes);
  });

  it('o banco só deixa a mensagem mudar para outro atendimento do mesmo hóspede', async () => {
    await A.hospede('5521977770010', 'O chuveiro não esquenta');
    const outro = await A.esperar(() => A.solicitacaoDe('5521977770010'));
    const m = await ondeFoi('A lâmpada ainda está piscando');
    await expect(A.consulta('UPDATE mensagem SET solicitacao_id = $2 WHERE id = (SELECT id FROM mensagem WHERE texto = $1)', ['A lâmpada ainda está piscando', outro.id])).rejects.toThrow(
      /mesmo solicitante/,
    );
    expect((await ondeFoi('A lâmpada ainda está piscando')).solicitacao_id).toBe(m.solicitacao_id);
  });

  it('terminada a manutenção, o paralelo passa a receber a conversa', async () => {
    expect((await A.req('POST', `/solicitacoes/${origemId}/resolver`, undefined, tokMarcos)).status).toBe(200);
    proximo = { assuntoNovo: false, confianca: 0.9, setor: 'vago' };
    await A.hospede(TEL, 'As toalhas já chegaram?');
    const paralela = (await solicitacoes()).find((x) => x.paralela_de === origemId)!;
    expect((await ondeFoi('As toalhas já chegaram?')).solicitacao_id).toBe(paralela.id);
  });
});
