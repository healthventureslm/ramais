/**
 * Escada de escalonamento configurável: avisos por tempo de espera (inclusive com o setor
 * vazio e para quem está fora do turno), lembrete ao responsável e "passar adiante" quando
 * o hóspede fica sem resposta.
 */
import { configHotel } from '@ramais/vertical-hotel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

const escadaManutencao = {
  ofertaSegundos: 60,
  lembrarMin: 2,
  repassarMin: 4,
  avisoSolicitanteMin: 6,
  avisos: [
    { aposMin: 3, alvo: { tipo: 'supervisores' } },
    { aposMin: 10, alvo: { tipo: 'turno', setor: 'recepcao' }, foraDoTurno: true },
  ],
};

describe.skipIf(!temBanco)('escada de escalonamento', () => {
  let A: Ambiente;
  let esc: { avaliar: (orgId: string, id: string) => Promise<void> };

  beforeAll(async () => {
    A = await subirAmbiente({
      modoIa: 'automatico',
      ajustes: { setores: configHotel.setores.map((s) => (s.chave === 'manutencao' ? { ...s, escalonamento: escadaManutencao } : s)) },
    });
    // @ts-ignore: módulo compilado
    const { Escalonamento } = await import('../dist/modules/distribuicao/escada.service.js');
    esc = A.worker.get(Escalonamento);
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  const atrasar = (id: string, seg: number, atendente = false) =>
    A.consulta(
      `UPDATE solicitacao SET espera_desde = now() - make_interval(secs => $2)${atendente ? ', atendente_desde = now() - make_interval(secs => $2)' : ''} WHERE id = $1`,
      [id, seg],
    );
  const eventos = (id: string, tipo: string) =>
    A.consulta<{ dados: any }>(`SELECT dados FROM evento WHERE solicitacao_id = $1 AND tipo = $2 ORDER BY criado_em`, [id, tipo]);

  it('setor vazio: a escada avisa por tempo, inclusive quem está fora do turno, e o hóspede', async () => {
    const tel = '5521977770001';
    await A.hospede(tel, 'A torneira do banheiro está vazando');
    const s = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.estado === 'na_fila' && x.setor === 'manutencao' ? x : null;
    });
    expect(s.espera_desde).not.toBeNull();

    // 3,5 min: degrau 1 (supervisores da Manutenção no turno: ninguém). Registrado mesmo assim.
    await atrasar(s.id, 210);
    await esc.avaliar(A.h.orgId, s.id);
    const [d1] = await A.esperar(async () => {
      const e = await eventos(s.id, 'escalonada');
      return e.length ? e : null;
    });
    expect(d1!.dados).toMatchObject({ degrau: 1, motivo: 'sem_aceite', destinatarios: [] });

    // 11 min: aviso ao hóspede e degrau 2 (Recepção, mesmo fora do turno).
    await atrasar(s.id, 660);
    await esc.avaliar(A.h.orgId, s.id);
    const e2 = await A.esperar(async () => {
      const e = await eventos(s.id, 'escalonada');
      return e.length >= 2 ? e : null;
    });
    expect(e2[1]!.dados).toMatchObject({ degrau: 2, foraDoTurno: true, destinatarios: [A.h.pessoas.rita.id] });
    await A.esperar(async () => (await A.saidas(s.id)).some((m) => m.texto.includes('demorando')));

    // Idempotente: avaliar de novo não repete nada.
    await esc.avaliar(A.h.orgId, s.id);
    expect(await eventos(s.id, 'escalonada')).toHaveLength(2);
    const final = await A.solicitacaoDe(tel);
    expect(final.supervisor_notificado_em).not.toBeNull();
    expect(final.escada_proxima_em).toBeNull();
  }, 60_000);

  it('sem resposta: lembra o responsável, passa para o próximo do setor e a resposta encerra a espera', async () => {
    const { h, req, login } = A;
    const tokens: Record<string, string> = {
      [h.pessoas.marcos.id]: await login(h.pessoas.marcos.email),
      [h.pessoas.milton.id]: await login(h.pessoas.milton.email),
    };
    for (const t of Object.values(tokens)) await req('POST', '/turno/entrar-web', { unidadeId: h.unidadeId }, t);

    const tel = '5521977770002';
    await A.hospede(tel, 'O chuveiro não esquenta');
    const o1 = await A.esperar(async () => {
      const s = await A.solicitacaoDe(tel);
      if (!s) return null;
      return (await A.consulta(`SELECT id, pessoa_id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [s.id]))[0];
    });
    const primeiro = o1.pessoa_id as string;
    expect(Object.keys(tokens)).toContain(primeiro);
    expect((await req('POST', `/ofertas/${o1.id}/aceitar`, undefined, tokens[primeiro])).status).toBe(200);
    const s = await A.solicitacaoDe(tel);
    expect(s.estado).toBe('em_atendimento');
    expect(s.atendente_desde).not.toBeNull();
    const esperaOriginal = new Date(s.espera_desde).getTime();

    // 2,5 min sem responder: lembrete para quem está com a conversa.
    await atrasar(s.id, 150, true);
    await esc.avaliar(h.orgId, s.id);
    const [lembrete] = await A.esperar(async () => {
      const e = await eventos(s.id, 'lembrete_resposta');
      return e.length ? e : null;
    });
    expect(lembrete!.dados.pessoaId).toBe(primeiro);

    // 4,5 min: passa para a outra pessoa do setor; a espera do hóspede continua contando.
    await atrasar(s.id, 270, true);
    const esperaAtrasada = new Date((await A.solicitacaoDe(tel)).espera_desde).getTime();
    await esc.avaliar(h.orgId, s.id);
    await A.esperar(async () => (await eventos(s.id, 'repassada')).length > 0);
    const o2 = await A.esperar(async () =>
      (await A.consulta(`SELECT id, pessoa_id FROM oferta WHERE solicitacao_id = $1 AND resultado = 'pendente'`, [s.id]))[0],
    );
    const segundo = o2.pessoa_id as string;
    expect(segundo).not.toBe(primeiro);
    expect(Object.keys(tokens)).toContain(segundo);
    const repassada = await A.solicitacaoDe(tel);
    expect(repassada.excluir_distribuicao).toEqual([primeiro]);
    expect(new Date(repassada.espera_desde).getTime()).toBe(esperaAtrasada);
    expect(esperaAtrasada).toBeLessThan(esperaOriginal);
    // 4,5 min de espera também passou do degrau 1 (supervisores, ninguém no turno).
    expect((await eventos(s.id, 'escalonada')).map((e) => e.dados.motivo)).toContain('sem_resposta');

    // A segunda pessoa aceita e responde: ninguém mais espera, a escada para.
    expect((await req('POST', `/ofertas/${o2.id}/aceitar`, undefined, tokens[segundo])).status).toBe(200);
    expect((await req('POST', `/solicitacoes/${s.id}/mensagens`, { texto: 'Já estou indo!', visibilidade: 'externa' }, tokens[segundo])).status).toBe(201);
    const fim = await A.solicitacaoDe(tel);
    expect(fim.estado).toBe('aguardando_solicitante');
    expect(fim.espera_desde).toBeNull();
    expect(fim.escada_proxima_em).toBeNull();

    // O hóspede escreve de novo: espera nova, escada do zero.
    await A.hospede(tel, 'Obrigado, mas ainda está frio');
    const nova = await A.esperar(async () => {
      const x = await A.solicitacaoDe(tel);
      return x?.estado === 'em_atendimento' && x.espera_desde ? x : null;
    });
    expect(nova.escada_feitos).toEqual([]);
    expect(nova.responsavel_id).toBe(segundo);
  }, 90_000);

  it('a configuração recusa aviso para setor inexistente e lembrete depois de passar adiante', async () => {
    const tok = await A.login(A.h.adminEmail);
    const ruim = {
      ...configHotel,
      escalonamento: { lembrarMin: 6, repassarMin: 4, avisos: [{ aposMin: 3, alvo: { tipo: 'turno', setor: 'nao_existe' } }] },
    };
    const r = await A.req('POST', '/admin/jornada/validar', { unidadeId: A.h.unidadeId, config: ruim }, tok);
    expect(r.corpo.valido).toBe(false);
    const msgs = r.corpo.erros.map((e: { erro: string }) => e.erro);
    expect(msgs).toEqual(expect.arrayContaining(['setor inexistente no aviso: nao_existe', 'o lembrete precisa vir antes de passar para outra pessoa']));
  });
});
