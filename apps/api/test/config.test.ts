/**
 * Editor de configuração: validar sem publicar, publicar uma versão nova (criando e
 * desativando setores) e o hóspede estrangeiro recebendo o nome do setor no idioma dele.
 */
import { configHotel } from '@ramais/vertical-hotel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('editor de configuração', () => {
  let A: Ambiente;
  let tok: string;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'automatico' });
    tok = await A.login(A.h.adminEmail);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  it('valida sem publicar e aponta o campo do erro', async () => {
    const ruim = { ...configHotel, tempos: { ...configHotel.tempos, inatividadeAvisoMin: 90, inatividadeEncerraMin: 60 } };
    const r = await A.req('POST', '/admin/jornada/validar', { unidadeId: A.h.unidadeId, config: ruim }, tok);
    expect(r.status).toBe(200);
    expect(r.corpo.valido).toBe(false);
    expect(r.corpo.erros[0].campo).toBe('tempos');
    // Publicar o mesmo é recusado.
    expect((await A.req('POST', '/admin/jornada', { unidadeId: A.h.unidadeId, config: ruim }, tok)).status).toBe(400);
  });

  it('publica versão nova: cria setor, desativa o removido e quem não é admin não publica', async () => {
    const spa = {
      chave: 'spa',
      nome: 'Spa',
      nomes: { es: 'Spa', en: 'Spa' },
      descricao: 'Spa and wellness: massages, sauna, treatments and their bookings.',
      exemplos: ['Can I book a massage?'],
      palavrasChave: ['massagem', 'massage', 'masaje', 'sauna'],
      casosDeBorda: [],
      exigeIdentificacao: false,
    };
    const nova = { ...configHotel, setores: [...configHotel.setores.filter((s) => s.chave !== 'concierge'), spa] };
    const val = await A.req('POST', '/admin/jornada/validar', { unidadeId: A.h.unidadeId, config: nova }, tok);
    expect(val.corpo.valido).toBe(true);
    expect(val.corpo.avisos.join(' ')).toMatch(/Spa será criado/);
    expect(val.corpo.avisos.join(' ')).toMatch(/Concierge será desativado/);

    const tokRita = await A.login(A.h.pessoas.rita.email);
    expect((await A.req('POST', '/admin/jornada', { unidadeId: A.h.unidadeId, config: nova }, tokRita)).status).toBe(403);

    const pub = await A.req('POST', '/admin/jornada', { unidadeId: A.h.unidadeId, config: nova, nota: 'spa' }, tok);
    expect(pub.status).toBe(201);
    expect(pub.corpo.numero).toBe(2);
    const setores = await A.consulta<{ chave: string; ativo: boolean; modo_ia: string }>(
      'SELECT chave, ativo, modo_ia FROM setor WHERE unidade_id = $1 ORDER BY chave',
      [A.h.unidadeId],
    );
    expect(setores.find((s) => s.chave === 'spa')).toMatchObject({ ativo: true, modo_ia: 'sombra' });
    expect(setores.find((s) => s.chave === 'concierge')).toMatchObject({ ativo: false });

    // Um pedido de spa já cai no setor novo (em sombra, via triagem).
    await A.hospede('5521933330001', 'Quero agendar uma massagem');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe('5521933330001');
      return x?.triagem ? x : null;
    });
    expect(s.sugerido).toBe('spa');
  });

  it('hóspede em espanhol recebe o nome do setor em espanhol', async () => {
    // Governança em sombra: a confirmação da triagem envia "encaminhado para <setor>".
    expect((await A.req('POST', '/admin/setores/modo-ia', { setorId: A.h.setores.governanca, modo: 'sombra' }, tok)).status).toBe(200);
    const tel = '5491133330002';
    await A.hospede(tel, 'Hola, necesito dos toallas más por favor');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.triagem ? x : null;
    });
    expect(s.idioma).toBe('es');
    const tokRita = await A.login(A.h.pessoas.rita.email);
    expect((await A.req('POST', `/solicitacoes/${s.id}/triagem`, { setorId: A.h.setores.governanca }, tokRita)).status).toBe(200);
    const enviado = await A.esperar(async () => {
      const r = await A.consulta<{ texto: string }>(
        `SELECT texto FROM mensagem WHERE solicitacao_id = $1 AND autor_tipo = 'sistema' AND texto LIKE '%Ama de llaves%'`,
        [s.id],
      );
      return r[0];
    });
    expect(enviado.texto).toMatch(/^¡Listo!/);
  });
});
