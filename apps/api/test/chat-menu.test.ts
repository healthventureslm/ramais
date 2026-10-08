/**
 * Menu principal do chat do quarto: "bom dia" recebe a explicação dos dois caminhos (escrever ou
 * escolher o setor), e escolher um setor no menu leva a conversa para lá a qualquer momento.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('menu principal do chat do quarto', () => {
  let A: Ambiente;
  let token: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
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
  const textos = async () => ((await chat('GET', '/chat')).corpo.mensagens as { texto: string | null }[]).map((m) => m.texto ?? '');
  const conversa = () =>
    A.consulta(
      `SELECT s.*, st.chave AS setor FROM solicitacao s JOIN solicitante so ON so.id = s.solicitante_id LEFT JOIN setor st ON st.id = s.setor_id
        WHERE so.telefone = $1 ORDER BY s.criado_em DESC`,
      [`quarto:${A.h.localId}`],
    );

  it('bom dia: explica que pode escrever ou escolher o setor no Menu principal', async () => {
    await chat('POST', '/chat/mensagens', { id: randomUUID(), texto: 'Bom dia' });
    const t = await A.esperar(async () => (await textos()).find((x) => x.startsWith('Olá! Escreva aqui')));
    expect(t).toContain('Menu principal');
    const v = (await chat('GET', '/chat')).corpo;
    expect(v.setores.map((s: { chave: string }) => s.chave)).toEqual(expect.arrayContaining(['recepcao', 'manutencao']));
    expect(v.setorAtual).toBeNull();
  }, 40_000);

  it('escolher no menu encaminha; trocar depois transfere; o mesmo setor não mexe em nada', async () => {
    expect((await chat('POST', '/chat/setor', { chave: 'manutencao' })).corpo).toEqual({ setor: 'Manutenção', jaEstava: false });
    let [s] = await conversa();
    expect(s.setor).toBe('manutencao');
    expect(['na_fila', 'oferecida']).toContain(s.estado);
    expect(await textos()).toContain('Pronto! Seu pedido foi encaminhado para Manutenção. Já te respondemos por aqui.');
    expect((await conversa()).length).toBe(1); // o "bom dia" não virou dois atendimentos

    // A primeira fala depois do menu vira o resumo que a equipe lê.
    await chat('POST', '/chat/mensagens', { id: randomUUID(), texto: 'A pia do banheiro está entupida' });
    await A.esperar(async () => ((await conversa())[0].resumo?.includes('pia') ? true : null));

    expect((await chat('POST', '/chat/setor', { chave: 'recepcao' })).corpo.jaEstava).toBe(false);
    [s] = await conversa();
    expect(s.setor).toBe('recepcao');
    const nota = await A.consulta(`SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND visibilidade = 'interna'`, [s.id]);
    expect(nota.map((n) => n.texto)).toContain('O hóspede escolheu Recepção no menu do chat (estava com Manutenção).');
    expect((await chat('GET', '/chat')).corpo.setorAtual).toBe('recepcao');

    expect((await chat('POST', '/chat/setor', { chave: 'recepcao' })).corpo.jaEstava).toBe(true);
    expect((await chat('POST', '/chat/setor', { chave: 'nao_existe' })).status).toBe(404);
  }, 60_000);

  it('sem atendimento aberto, o menu abre um já na fila do setor', async () => {
    const [s] = await conversa();
    await A.consulta(`UPDATE solicitacao SET estado = 'encerrada', encerrada_em = now() WHERE id = $1`, [s.id]);
    expect((await chat('POST', '/chat/setor', { chave: 'governanca' })).corpo.jaEstava).toBe(false);
    const [nova] = await conversa();
    expect(nova.id).not.toBe(s.id);
    expect(nova).toMatchObject({ setor: 'governanca', local_id: A.h.localId, origem: 'externa', resumo: 'Hóspede escolheu Governança no menu do chat' });
  }, 40_000);
});
