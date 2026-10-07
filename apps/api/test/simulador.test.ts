/**
 * Simulador do construtor: o admin conversa como hóspede usando o rascunho, sem que a
 * conversa chegue à equipe, à Meta, às listas ou às estatísticas.
 */
import { configHotel } from '@ramais/vertical-hotel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('simulador do construtor', () => {
  let A: Ambiente;
  let tokAdmin: string;
  const rascunho = {
    ...configHotel,
    fluxo: {
      ...configHotel.fluxo,
      entrada: [
        {
          id: 'oi',
          tipo: 'mensagem',
          conteudo: { tipo: 'livre', texto: { pt: 'Oi! Teste do rascunho.', es: '¡Hola! Prueba.', en: 'Hi! Draft test.' } },
          quando: [{ tipo: 'primeira_mensagem', nao: false }],
        },
      ],
    },
  };

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    tokAdmin = await A.login(A.h.adminEmail);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const estado = async () => (await A.req('GET', `/admin/simulador?unidadeId=${A.h.unidadeId}`, undefined, tokAdmin)).corpo;

  it('roda o rascunho, mostra a trilha e não chega à equipe', async () => {
    const [antes] = await A.consulta<{ jornada_versao_id: string }>('SELECT jornada_versao_id FROM unidade WHERE id = $1', [A.h.unidadeId]);
    // Rita no turno: se a conversa de teste fosse para a fila, ela receberia uma oferta.
    const tokRita = await A.login(A.h.pessoas.rita.email);
    await A.req('POST', '/turno/entrar-web', { unidadeId: A.h.unidadeId }, tokRita);

    const r = await A.req('POST', '/admin/simulador/mensagem', { unidadeId: A.h.unidadeId, config: rascunho, texto: 'Meu cartão não abre a porta' }, tokAdmin);
    expect(r.status).toBe(202);
    const e = await A.esperar(async () => {
      const x = await estado();
      return x.conversa?.estado === 'na_fila' && x.mensagens.length >= 3 ? x : null;
    });
    expect(e.conversa.versao).toBe('rascunho');
    expect(e.conversa.setor).toBe('Recepção');
    expect(e.mensagens.map((m: { texto: string }) => m.texto)).toEqual(expect.arrayContaining(['Oi! Teste do rascunho.']));
    const trilha = e.eventos.filter((x: { tipo: string }) => x.tipo === 'fluxo').flatMap((x: { dados: { trilha: unknown[] } }) => x.dados.trilha);
    expect(trilha).toEqual(expect.arrayContaining([expect.objectContaining({ bloco: 'oi', r: 'seguir' })]));
    expect(e.eventos.some((x: { tipo: string }) => x.tipo === 'decisao_ia')).toBe(true);

    // Nada disso chega à equipe nem à Meta.
    await new Promise((res) => setTimeout(res, 1500));
    const ofertas = await A.req('GET', '/ofertas', undefined, tokRita);
    expect(ofertas.corpo).toEqual([]);
    const lista = await A.req('GET', `/solicitacoes?filtro=setores&unidadeId=${A.h.unidadeId}`, undefined, tokRita);
    expect(lista.corpo.find((x: { id: string }) => x.id === e.conversa.id)).toBeUndefined();
    const enviados = await A.consulta<{ wa_message_id: string }>(
      `SELECT wa_message_id FROM mensagem WHERE solicitacao_id = $1 AND autor_tipo <> 'solicitante' AND visibilidade = 'externa'`,
      [e.conversa.id],
    );
    expect(enviados.every((m) => m.wa_message_id.startsWith('teste.'))).toBe(true);
    const stats = await A.req('GET', `/admin/automacao?unidadeId=${A.h.unidadeId}`, undefined, tokAdmin);
    expect(stats.corpo.reduce((n: number, x: { avaliadas: number }) => n + x.avaliadas, 0)).toBe(0);

    // A versão publicada não mudou.
    const [depois] = await A.consulta<{ jornada_versao_id: string }>('SELECT jornada_versao_id FROM unidade WHERE id = $1', [A.h.unidadeId]);
    expect(depois!.jornada_versao_id).toBe(antes!.jornada_versao_id);
  });

  it('recomeçar fecha a conversa de teste; a próxima começa do zero', async () => {
    const antes = (await estado()).conversa.id;
    expect((await A.req('POST', '/admin/simulador/reiniciar', { unidadeId: A.h.unidadeId }, tokAdmin)).status).toBe(200);
    await A.req('POST', '/admin/simulador/mensagem', { unidadeId: A.h.unidadeId, config: rascunho, texto: 'Qual a senha do Wi-Fi?' }, tokAdmin);
    const e = await A.esperar(async () => {
      const x = await estado();
      return x.conversa && x.conversa.id !== antes && x.mensagens.length >= 2 ? x : null;
    });
    expect(e.mensagens[0].texto).toBe('Qual a senha do Wi-Fi?');
  });

  it('rascunho com erro não roda', async () => {
    const ruim = { ...rascunho, setorFallback: 'nao_existe' };
    const r = await A.req('POST', '/admin/simulador/mensagem', { unidadeId: A.h.unidadeId, config: ruim, texto: 'oi' }, tokAdmin);
    expect(r.status).toBe(400);
  });
});
