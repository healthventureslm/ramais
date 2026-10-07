/**
 * Modo sombra: a IA sugere, a triagem (recepção) confirma ou corrige, e o acerto
 * por setor diz quando liberar o automático.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subirAmbiente, temBanco, type Ambiente } from './ambiente.js';

describe.skipIf(!temBanco)('modo sombra', () => {
  let A: Ambiente;

  beforeAll(async () => {
    A = await subirAmbiente({ modoIa: 'sombra' });
  }, 60_000);

  afterAll(async () => {
    await A?.fechar();
  });

  it('em sombra, o pedido vai para a triagem com a sugestão; confirmar leva ao setor sugerido', async () => {
    const { h, req, hospede, esperar, solicitacaoDe, saidas, login, consulta } = A;
    const tel = '5521922220001';
    await hospede(tel, 'O chuveiro está sem água quente');
    const s = await esperar(async () => {
      const x = await solicitacaoDe(tel);
      return x?.triagem ? x : null;
    });
    expect(s.setor).toBe('recepcao');
    expect(s.sugerido).toBe('manutencao');
    // O hóspede não recebe o nome de um setor que ainda não foi confirmado.
    await esperar(async () => (await saidas(s.id)).some((m) => m.texto.includes('pessoa certa')));

    const tokRita = await login(h.pessoas.rita.email);
    const lista = await req('GET', `/solicitacoes?filtro=setores&unidadeId=${h.unidadeId}`, undefined, tokRita);
    const item = lista.corpo.find((x: any) => x.id === s.id);
    expect(item.triagem.setorSugerido.id).toBe(h.setores.manutencao);

    // Manutenção não pode triar (não está na triagem nem é supervisor dela).
    const tokMarcos = await login(h.pessoas.marcos.email);
    expect((await req('POST', `/solicitacoes/${s.id}/triagem`, { setorId: h.setores.manutencao }, tokMarcos)).status).toBe(403);

    expect((await req('POST', `/solicitacoes/${s.id}/triagem`, { setorId: h.setores.manutencao }, tokRita)).status).toBe(200);
    const depois = await solicitacaoDe(tel);
    expect(depois.setor).toBe('manutencao');
    expect(depois.triagem).toBe(false);
    const [d] = await consulta('SELECT revisao, sombra FROM decisao_ia WHERE id = $1', [s.decisao_sugerida_id]);
    expect(d).toEqual({ revisao: 'confirmada', sombra: true });
    await esperar(async () => (await saidas(s.id)).some((m) => m.texto.includes('Manutenção')));
    // Triar de novo: já saiu da triagem.
    expect((await req('POST', `/solicitacoes/${s.id}/triagem`, { setorId: h.setores.manutencao }, tokRita)).status).toBe(409);
  }, 60_000);

  it('corrigir a sugestão registra a correção para calibrar', async () => {
    const { h, req, hospede, esperar, solicitacaoDe, login, consulta } = A;
    const tel = '5521922220002';
    await hospede(tel, 'Podem trazer mais toalhas?');
    const s = await esperar(async () => {
      const x = await solicitacaoDe(tel);
      return x?.triagem ? x : null;
    });
    expect(s.sugerido).toBe('governanca');
    const tokRita = await login(h.pessoas.rita.email);
    // Transferir um pedido em triagem é corrigir a sugestão.
    expect((await req('POST', `/solicitacoes/${s.id}/transferir`, { setorId: h.setores.concierge }, tokRita)).status).toBe(200);
    expect((await solicitacaoDe(tel)).setor).toBe('concierge');
    const [d] = await consulta('SELECT revisao FROM decisao_ia WHERE id = $1', [s.decisao_sugerida_id]);
    expect(d.revisao).toBe('corrigida');
    const [c] = await consulta('SELECT count(*)::int AS n FROM correcao WHERE decisao_id = $1', [s.decisao_sugerida_id]);
    expect(c.n).toBe(1);
  }, 60_000);

  it('o admin vê o acerto por setor e libera o automático', async () => {
    const { h, req, hospede, esperar, solicitacaoDe, login } = A;
    const tokAdmin = await login(h.adminEmail);
    const stats = await req('GET', `/admin/automacao?unidadeId=${h.unidadeId}`, undefined, tokAdmin);
    const man = stats.corpo.find((x: any) => x.chave === 'manutencao');
    expect(man).toMatchObject({ modo: 'sombra', avaliadas: 1, acerto: 1 });
    const gov = stats.corpo.find((x: any) => x.chave === 'governanca');
    expect(gov).toMatchObject({ avaliadas: 1, acerto: 0 });

    expect((await req('POST', '/admin/setores/modo-ia', { setorId: h.setores.manutencao, modo: 'automatico' }, tokAdmin)).status).toBe(200);
    const tel = '5521922220003';
    await hospede(tel, 'A TV não liga');
    const s = await esperar(async () => {
      const x = await solicitacaoDe(tel);
      return x?.estado === 'na_fila' ? x : null;
    });
    expect(s.setor).toBe('manutencao');
    expect(s.triagem).toBe(false);
  }, 60_000);
});
