import { describe, expect, it } from 'vitest';
import { Escada, type Candidato, type ItemFila, type ResultadoRoteamento } from '@ramais/contracts';
import {
  aplicarGate,
  trocarIdioma,
  destinoNovaMensagem,
  ErroTransicao,
  extrairCodigoLocal,
  extrairQuartoSobrenome,
  filtrarCandidatos,
  gatilhoPorPalavra,
  gatilhoVencedor,
  idiomaDosTextos,
  menorCarga,
  normalizar,
  ordenarFila,
  planejarDistribuicao,
  planoEscada,
  proximaEspera,
  relatorio,
  removerCodigoLocal,
  sobrenomeConfere,
  sugerirLimite,
  degrauAtual,
  transicionar,
} from './index.js';

const cand = (id: string, o: Partial<Candidato> = {}): Candidato => ({
  pessoaId: id,
  recebe: 'sempre',
  papel: 'membro',
  carga: 0,
  limiteCarga: 5,
  idiomas: ['pt'],
  ultimaOfertaEm: null,
  ...o,
});

const item = (id: string, o: Partial<ItemFila> = {}): ItemFila => ({
  solicitacaoId: id,
  urgencia: 'rotina',
  entrouFilaEm: new Date('2026-10-01T10:00:00Z'),
  idioma: 'pt',
  excluir: [],
  ...o,
});

describe('estados', () => {
  it('segue o caminho feliz', () => {
    let e = transicionar('automacao', 'entrar_fila');
    e = transicionar(e, 'ofertar');
    e = transicionar(e, 'aceitar');
    e = transicionar(e, 'aguardar_solicitante');
    e = transicionar(e, 'solicitante_respondeu');
    e = transicionar(e, 'resolver');
    expect(transicionar(e, 'encerrar')).toBe('encerrada');
  });

  it('oferta expirada volta para a fila', () => {
    expect(transicionar('oferecida', 'expirar_oferta')).toBe('na_fila');
  });

  it('rejeita transição inválida', () => {
    expect(() => transicionar('encerrada', 'aceitar')).toThrow(ErroTransicao);
    expect(() => transicionar('na_fila', 'aceitar')).toThrow(ErroTransicao);
  });

  it('reabre dentro da janela e abre nova depois', () => {
    const agora = new Date('2026-10-02T12:00:00Z');
    const resolvida = (h: number) => ({ estado: 'resolvida' as const, resolvidaEm: new Date(agora.getTime() - h * 3.6e6) });
    expect(destinoNovaMensagem(resolvida(2), agora, 24)).toBe('reabrir');
    expect(destinoNovaMensagem(resolvida(25), agora, 24)).toBe('nova');
    expect(destinoNovaMensagem({ estado: 'em_atendimento', resolvidaEm: null }, agora, 24)).toBe('continuar');
    expect(destinoNovaMensagem(null, agora, 24)).toBe('nova');
  });
});

describe('distribuição', () => {
  it('ordena por urgência e depois por espera', () => {
    const fila = ordenarFila([
      item('a', { entrouFilaEm: new Date('2026-10-01T09:00:00Z') }),
      item('b', { urgencia: 'agora', entrouFilaEm: new Date('2026-10-01T11:00:00Z') }),
      item('c', { entrouFilaEm: new Date('2026-10-01T08:00:00Z') }),
    ]);
    expect(fila.map((i) => i.solicitacaoId)).toEqual(['b', 'c', 'a']);
  });

  it('escolhe menor carga e respeita limite e exclusões', () => {
    const cands = [cand('p1', { carga: 2 }), cand('p2', { carga: 1 }), cand('p3', { carga: 5 })];
    expect(menorCarga.escolher(cands, item('x'))).toBe('p2');
    expect(menorCarga.escolher(cands, item('x', { excluir: ['p2'] }))).toBe('p1');
  });

  it('supervisor como último recurso só recebe quando é o único', () => {
    const sup = cand('sup', { recebe: 'ultimo_recurso', papel: 'supervisor' });
    expect(filtrarCandidatos([cand('p1', { carga: 3 }), sup], item('x')).map((c) => c.pessoaId)).toEqual(['p1']);
    expect(filtrarCandidatos([cand('p1', { carga: 5 }), sup], item('x')).map((c) => c.pessoaId)).toEqual(['sup']);
    expect(filtrarCandidatos([cand('n', { recebe: 'nunca' })], item('x'))).toEqual([]);
  });

  it('prefere o atendente anterior (continuidade)', () => {
    const cands = [cand('p1', { carga: 0 }), cand('p2', { carga: 2 })];
    expect(menorCarga.escolher(cands, item('x', { preferir: 'p2' }))).toBe('p2');
  });

  it('desempata por idioma do solicitante', () => {
    const cands = [cand('p1'), cand('p2', { idiomas: ['pt', 'es'] })];
    expect(menorCarga.escolher(cands, item('x', { idioma: 'es' }))).toBe('p2');
  });

  it('planeja a fila inteira espalhando a carga', () => {
    const plano = planejarDistribuicao(
      [item('a'), item('b'), item('c')],
      [cand('p1', { limiteCarga: 1 }), cand('p2', { limiteCarga: 1 })],
      menorCarga,
    );
    expect(plano.ofertas.map((o) => o.pessoaId).sort()).toEqual(['p1', 'p2']);
    expect(plano.semCandidato).toEqual(['c']);
  });
});

describe('escalonamento', () => {
  const t0 = new Date('2026-10-05T12:00:00Z');
  const min = (m: number) => new Date(t0.getTime() + m * 60_000);
  const escada = Escada.parse({
    lembrarMin: 2,
    repassarMin: 4,
    avisoSolicitanteMin: 6,
    avisos: [
      { aposMin: 3, alvo: { tipo: 'supervisores' } },
      { aposMin: 8, alvo: { tipo: 'pessoa', pessoaId: '00000000-0000-4000-8000-000000000001' }, foraDoTurno: true },
    ],
  });

  it('na fila: avisos e aviso ao hóspede por tempo de espera, sem lembrete (ninguém aceitou)', () => {
    const e = { esperaDesde: t0, atendenteDesde: null, estado: 'na_fila' as const, externa: true };
    expect(planoEscada(escada, e, [], min(1))).toEqual({ devidos: [], proximoEm: min(3) });
    const p = planoEscada(escada, e, [], min(7));
    expect(p.devidos.map((x) => x.id)).toEqual(['aviso:0', 'solicitante']);
    expect(p.proximoEm).toEqual(min(8));
    // O que já foi feito não repete.
    expect(planoEscada(escada, e, ['aviso:0', 'solicitante'], min(9)).devidos.map((x) => x.id)).toEqual(['aviso:1']);
  });

  it('em atendimento: lembra e passa adiante contando do aceite; avisos contando da espera', () => {
    const e = { esperaDesde: t0, atendenteDesde: min(2.5), estado: 'em_atendimento' as const, externa: true };
    const p = planoEscada(escada, e, [], min(7));
    expect(p.devidos.map((x) => x.tipo)).toEqual(['avisar', 'lembrar', 'avisar_solicitante', 'repassar']);
    // Quem pega depois tem os próprios lembretes.
    const outro = { ...e, atendenteDesde: min(7) };
    const feitos = p.devidos.map((x) => x.id);
    expect(planoEscada(escada, outro, feitos, min(9.5)).devidos.map((x) => x.tipo)).toEqual(['avisar', 'lembrar']);
  });

  it('pedido interno não lembra nem avisa solicitante', () => {
    const e = { esperaDesde: t0, atendenteDesde: min(1), estado: 'em_atendimento' as const, externa: false };
    expect(planoEscada(escada, e, [], min(30)).devidos.map((x) => x.tipo)).toEqual(['avisar', 'avisar']);
  });

  it('a espera continua ao passar de mão no mesmo setor e recomeça em outro setor', () => {
    const agora = min(10);
    const atendendo = { estado: 'em_atendimento' as const, setorId: 's1', esperaDesde: t0, atendenteDesde: min(1) };
    expect(proximaEspera(atendendo, { estado: 'na_fila', setorId: 's1' }, true, agora)).toEqual({ esperaDesde: t0, atendenteDesde: null });
    expect(proximaEspera(atendendo, { estado: 'na_fila', setorId: 's2' }, true, agora)).toEqual({ esperaDesde: agora, atendenteDesde: null });
    // Aceite: a espera do hóspede continua, o relógio do atendente começa.
    const fila = { estado: 'oferecida' as const, setorId: 's1', esperaDesde: t0, atendenteDesde: null };
    expect(proximaEspera(fila, { estado: 'em_atendimento', setorId: 's1' }, true, agora)).toEqual({ esperaDesde: t0, atendenteDesde: agora });
    // Pedido interno: o aceite encerra a espera.
    expect(proximaEspera(fila, { estado: 'em_atendimento', setorId: 's1' }, false, agora)).toEqual({ esperaDesde: null, atendenteDesde: null });
    // A equipe respondeu: ninguém espera. O hóspede escreveu de novo: espera nova.
    const respondido = proximaEspera(atendendo, { estado: 'aguardando_solicitante', setorId: 's1' }, true, agora);
    expect(respondido).toEqual({ esperaDesde: null, atendenteDesde: null });
    expect(
      proximaEspera({ ...atendendo, ...respondido, estado: 'aguardando_solicitante' }, { estado: 'em_atendimento', setorId: 's1' }, true, agora),
    ).toEqual({ esperaDesde: agora, atendenteDesde: agora });
  });

  it('degrau do painel', () => {
    expect(degrauAtual(0, [])).toBe(0);
    expect(degrauAtual(1, [])).toBe(1);
    expect(degrauAtual(0, ['lembrar:1'])).toBe(1);
    expect(degrauAtual(0, ['aviso:0'])).toBe(2);
  });
});

const resultado = (setor: string, conf: number, flags: Partial<ResultadoRoteamento['saida']> = {}, confFlags = 0.9): ResultadoRoteamento => ({
  saida: {
    setor,
    urgencia: 'rotina',
    emergencia: false,
    pede_humano: false,
    quer_encerrar: false,
    setor_errado: false,
    reclama_demora: false,
    insatisfeito: false,
    idioma: 'pt',
    ...flags,
  },
  confianca: {
    setor: conf,
    urgencia: 0.9,
    idioma: 0.9,
    emergencia: confFlags,
    pede_humano: confFlags,
    quer_encerrar: confFlags,
    setor_errado: confFlags,
    reclama_demora: confFlags,
    insatisfeito: confFlags,
  },
  motor: 'teste',
  latenciaMs: 1,
  metodoConfianca: 'regra',
});

const limites = { encaminha: 0.85, baixaCerteza: 0.6, emergencia: 0.3, gatilho: 0.7 };

describe('gate', () => {
  it('encaminha, marca baixa certeza, manda à recepção ou pergunta', () => {
    expect(aplicarGate(resultado('manutencao', 0.9), limites).acao).toBe('encaminhar');
    expect(aplicarGate(resultado('manutencao', 0.7), limites)).toEqual({ acao: 'encaminhar_baixa_certeza', setor: 'manutencao' });
    expect(aplicarGate(resultado('manutencao', 0.4), limites).acao).toBe('recepcao');
    expect(aplicarGate(resultado('vago', 0.99), limites).acao).toBe('perguntar');
    expect(aplicarGate(resultado('nenhum', 0.99), limites).acao).toBe('recepcao');
  });

  it('respeita a precedência dos gatilhos', () => {
    const r = resultado('x', 0.9, { pede_humano: true, emergencia: true });
    expect(gatilhoVencedor(null, r, limites)).toBe('emergencia');
    expect(gatilhoVencedor('quer_encerrar', resultado('x', 0.9, { pede_humano: true }), limites)).toBe('quer_encerrar');
  });

  it('emergência dispara com confiança baixa; os outros não', () => {
    expect(gatilhoVencedor(null, resultado('x', 0.9, { emergencia: true }, 0.35), limites)).toBe('emergencia');
    expect(gatilhoVencedor(null, resultado('x', 0.9, { pede_humano: true }, 0.35), limites)).toBeNull();
  });

  it('palavra-chave exige a mensagem inteira', () => {
    const p = { encerrar: ['sair'], humano: ['atendente'], emergencia: [] };
    expect(gatilhoPorPalavra('  Sair! ', p)).toBe('quer_encerrar');
    expect(gatilhoPorPalavra('quero sair da piscina', p)).toBeNull();
    expect(gatilhoPorPalavra('ATENDENTE', p)).toBe('pede_humano');
  });

  it('normaliza acentos', () => {
    expect(normalizar('Não, OBRIGADO!!')).toBe('nao obrigado');
  });
});

describe('identificação', () => {
  it('extrai e remove o código do QR', () => {
    const t = 'Olá! Preciso de ajuda. (código #R-k7Qp2xAb)';
    expect(extrairCodigoLocal(t)).toBe('k7Qp2xAb');
    expect(removerCodigoLocal(t)).toBe('Olá! Preciso de ajuda.');
    expect(extrairCodigoLocal('sem código')).toBeNull();
  });

  it('entende quarto e sobrenome em vários formatos', () => {
    expect(extrairQuartoSobrenome('302 Silva')).toEqual({ quarto: '302', sobrenome: 'silva' });
    expect(extrairQuartoSobrenome('Quarto 1204, sobrenome Fernández')).toEqual({ quarto: '1204', sobrenome: 'fernandez' });
    expect(extrairQuartoSobrenome('room 15 my last name is Smith')).toEqual({ quarto: '15', sobrenome: 'smith' });
    expect(extrairQuartoSobrenome('oi tudo bem')).toBeNull();
  });

  it('confere sobrenome composto', () => {
    expect(sobrenomeConfere('silva', 'da Silva Santos')).toBe(true);
    expect(sobrenomeConfere('souza', 'da Silva Santos')).toBe(false);
  });

  it('usa inglês para idiomas fora dos fixos', () => {
    expect(idiomaDosTextos('es')).toBe('es');
    expect(idiomaDosTextos('fr')).toBe('en');
    expect(idiomaDosTextos(null)).toBe('en');
  });
});

describe('calibração', () => {
  it('mede acurácia, faixas e separação', () => {
    const amostras = [
      { previsto: 'a', correto: 'a', confianca: 0.95 },
      { previsto: 'a', correto: 'a', confianca: 0.9 },
      { previsto: 'b', correto: 'a', confianca: 0.5 },
      { previsto: 'b', correto: 'b', confianca: 0.7 },
    ];
    const r = relatorio(amostras);
    expect(r.acuracia).toBe(0.75);
    expect(r.matriz.a).toEqual({ a: 2, b: 1 });
    expect(r.auroc).toBe(1);
    expect(sugerirLimite(amostras, 1, 2)).toBe(0.7);
  });
});

describe('idioma da conversa', () => {
  const base = { atual: 'ja', definido: true, confianca: 0.9, transcrito: false };
  it('pouco texto não troca o idioma já definido', () => {
    expect(trocarIdioma({ ...base, detectado: 'en', texto: '5' })).toBe(false);
    expect(trocarIdioma({ ...base, detectado: 'pt', texto: '302 Silva' })).toBe(false);
    expect(trocarIdioma({ ...base, detectado: 'en', texto: 'Thank you!' })).toBe(false);
  });
  it('uma frase de verdade, ou um áudio, troca', () => {
    expect(trocarIdioma({ ...base, detectado: 'en', texto: 'Actually, can we switch to English please?' })).toBe(true);
    expect(trocarIdioma({ ...base, detectado: 'en', texto: 'ok', transcrito: true })).toBe(true);
  });
  it('a primeira mensagem define, mesmo curta; detecção fraca não troca', () => {
    expect(trocarIdioma({ ...base, atual: 'pt', definido: false, detectado: 'en', texto: 'Hi' })).toBe(true);
    expect(trocarIdioma({ ...base, detectado: 'en', confianca: 0.6, texto: 'Could you send two more towels to our room?' })).toBe(false);
  });
});
