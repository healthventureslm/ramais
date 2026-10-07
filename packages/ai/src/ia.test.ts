import { describe, expect, it } from 'vitest';
import { ErroMotor, type MotorDecisao } from '@ramais/contracts';
import { setoresHotel } from '../../verticals/hotel/src/catalogo.js';
import {
  CadeiaMotores,
  ClienteOpenRouter,
  nomeDoIdioma,
  TradutorEmCadeia,
  TradutorLLM,
  type Tradutor,
  type UsoIA,
  conferirNumeros,
  detectarIdioma,
  distribuicaoPorLogprobs,
  ehModeloDeDecisao,
  MotorJev,
  type ClienteDecisoes,
  type PedidoDecisoes,
  type RespostaDecisao,
  MotorLLM,
  MotorPalavras,
  RespondedorPalavras,
  Roteador,
  type ClienteChat,
  type PedidoChat,
  type RespostaChat,
} from './index.js';

const setores = setoresHotel.map((s) => ({ chave: s.chave, descricao: s.descricao, palavrasChave: s.palavrasChave }));
const entrada = (texto: string) => ({ texto, historico: [], fatos: {}, setores });

class ClienteFalso implements ClienteChat {
  pedidos: PedidoChat[] = [];
  constructor(private readonly respostas: ((p: PedidoChat, i: number) => Partial<RespostaChat> | Error)[]) {}
  async chat(p: PedidoChat): Promise<RespostaChat> {
    const i = this.pedidos.length;
    this.pedidos.push(p);
    const f = this.respostas[i % this.respostas.length]!;
    const r = f(p, i);
    if (r instanceof Error) throw r;
    return { conteudo: '{}', modelo: 'falso', logprobs: null, tokensEntrada: 1, tokensSaida: 1, ...r };
  }
}

/** Resposta JSON com as letras de cada pergunta, a partir do schema pedido. */
function responder(escolhas: Record<string, string>) {
  return (p: PedidoChat) => {
    const props = (p.esquema!.schema as { properties: Record<string, { enum: string[] }> }).properties;
    const json: Record<string, string> = {};
    for (const [id, def] of Object.entries(props)) json[id] = escolhas[id] ?? def.enum[0]!;
    return { conteudo: JSON.stringify(json) };
  };
}

describe('motor de palavras-chave', () => {
  const roteador = new Roteador(new MotorPalavras(setores));

  it('roteia pelo catálogo, com confiança de baixa certeza', async () => {
    const r = await roteador.rotear(entrada('O ar condicionado está pingando no chão'));
    expect(r.saida.setor).toBe('manutencao');
    expect(r.confianca.setor).toBeGreaterThanOrEqual(0.6);
    expect(r.confianca.setor).toBeLessThan(0.85);
    expect(r.metodoConfianca).toBe('regra');
  });

  it('entende espanhol e inglês', async () => {
    expect((await roteador.rotear(entrada('Necesito dos toallas más por favor'))).saida.setor).toBe('governanca');
    expect((await roteador.rotear(entrada('There is no hot water in the shower'))).saida.setor).toBe('manutencao');
  });

  it('saudação é vaga', async () => {
    const r = await roteador.rotear(entrada('Oi, bom dia'));
    expect(r.saida.setor).toBe('vago');
  });

  it('detecta emergência e idioma', async () => {
    const r = await roteador.rotear(entrada('Socorro, tem fumaça saindo do quarto ao lado!'));
    expect(r.saida.emergencia).toBe(true);
    expect(r.confianca.emergencia).toBeGreaterThan(0.3);
    expect(r.saida.idioma).toBe('pt');
  });
});

describe('motor LLM', () => {
  it('autoconsistência: concordância vira confiança e "nunca escolhe opção proibida"', async () => {
    const cliente = new ClienteFalso([
      responder({ setor: 'C' }),
      responder({ setor: 'C' }),
      responder({ setor: 'B' }),
    ]);
    const r = await new Roteador(new MotorLLM({ cliente, modelo: 'm', metodo: 'autoconsistencia', amostras: 3 })).rotear(
      entrada('the AC is noisy'),
    );
    expect(r.saida.setor).toBe('manutencao');
    expect(r.confianca.setor).toBeCloseTo(2 / 3);
    expect(r.metodoConfianca).toBe('autoconsistencia');
    // As opções do schema são só as letras dos setores permitidos + vago + nenhum.
    const enumSetor = (cliente.pedidos[0]!.esquema!.schema as any).properties.setor.enum;
    expect(enumSetor).toHaveLength(setores.length + 2);
  });

  it('amostra inválida conta como discordância', async () => {
    const cliente = new ClienteFalso([responder({ setor: 'C' }), () => ({ conteudo: 'lixo' }), responder({ setor: 'C' })]);
    const r = await new Roteador(new MotorLLM({ cliente, modelo: 'm', metodo: 'autoconsistencia', amostras: 3 })).rotear(
      entrada('x'),
    );
    expect(r.confianca.setor).toBeCloseTo(2 / 3);
  });

  it('logprobs: lê a probabilidade do token da letra', () => {
    const tokens = [
      { token: '{"', logprob: 0 },
      { token: 'setor', logprob: 0 },
      { token: '":"', logprob: 0 },
      { token: 'C', logprob: Math.log(0.7), top_logprobs: [
        { token: 'C', logprob: Math.log(0.7) },
        { token: 'B', logprob: Math.log(0.2) },
        { token: 'Z', logprob: Math.log(0.1) },
      ] },
      { token: '"}', logprob: 0 },
    ];
    const d = distribuicaoPorLogprobs(tokens, 'setor', ['A', 'B', 'C']);
    expect(d!.C).toBeCloseTo(0.7 / 0.9);
    expect(d!.B).toBeCloseTo(0.2 / 0.9);
  });
});

describe('motor Jev (Decisions API)', () => {
  it('usa a confiança nativa, converte noul e manda critérios por opção', async () => {
    let pedido: PedidoDecisoes | null = null;
    const cliente: ClienteDecisoes = {
      async decisoes(p) {
        pedido = p;
        const respostas: Record<string, RespostaDecisao> = {};
        for (const [id, q] of Object.entries(p.perguntas)) {
          if (q.type === 'noul') respostas[id] = { type: 'noul', noul: id === 'emergencia' ? 0.06 : 0.02 };
          else if (id === 'setor') respostas[id] = { type: 'choice', choice: 'manutencao', confidence: 0.93, probabilities: { manutencao: 0.95, recepcao: 0.05 } };
          else respostas[id] = { type: 'choice', choice: Object.keys(q.criteria)[0]!, confidence: 0.9 };
        }
        return { respostas, modelo: 'typesafe/jev-1.13', custo: 0.00002 };
      },
    };
    const r = await new Roteador(new MotorJev({ cliente, modelo: 'typesafe/jev-1.13' })).rotear(entrada('O ar está pingando'));
    expect(r.saida.setor).toBe('manutencao');
    expect(r.confianca.setor).toBe(0.93);
    expect(r.metodoConfianca).toBe('nativa');
    expect(r.saida.emergencia).toBe(false);
    expect(r.confianca.emergencia).toBeCloseTo(0.06); // probabilidade de "sim"
    const p = pedido as unknown as PedidoDecisoes;
    expect(p.perguntas.emergencia!.type).toBe('noul');
    const setor = p.perguntas.setor as { criteria: Record<string, string> };
    expect(setor.criteria.manutencao).toMatch(/Maintenance/);
    expect(Object.keys(setor.criteria)).toContain('vago');
    // O catálogo vai nos critérios; o estado leva só a mensagem e os fatos.
    expect(String(p.estado)).not.toMatch(/Departments/);
    expect(String(p.estado)).toMatch(/O ar está pingando/);
  });

  it('recusa opção fora da lista', async () => {
    const cliente: ClienteDecisoes = {
      async decisoes(p) {
        return {
          respostas: Object.fromEntries(
            Object.entries(p.perguntas).map(([id, q]) => [id, q.type === 'noul' ? { type: 'noul', noul: 0 } : { type: 'choice', choice: 'inventado' }]),
          ) as Record<string, RespostaDecisao>,
          modelo: 'x',
          custo: null,
        };
      },
    };
    await expect(new MotorJev({ cliente, modelo: 'typesafe/jev-1.13' }).decidir({ estado: 'x', perguntas: [{ id: 'setor', texto: 't', opcoes: ['a'] }] })).rejects.toThrow(/fora da lista/);
  });

  it('só modelos de decisão vão pela Decisions API', () => {
    expect(ehModeloDeDecisao('typesafe/jev-1.13')).toBe(true);
    expect(ehModeloDeDecisao('~typesafe/jev-latest')).toBe(true);
    expect(ehModeloDeDecisao('typesafe/jev-router')).toBe(false);
    expect(ehModeloDeDecisao('google/gemini-3.1-flash-lite')).toBe(false);
  });
});

describe('cadeia com disjuntor', () => {
  it('cai para o próximo motor e abre o disjuntor após N falhas', async () => {
    let agora = 0;
    let chamadas = 0;
    const quebrado: MotorDecisao = {
      nome: 'quebrado',
      async decidir() {
        chamadas++;
        throw new ErroMotor('indisponivel', 'fora');
      },
    };
    const cadeia = new CadeiaMotores([quebrado, new MotorPalavras(setores)], {
      falhasParaAbrir: 2,
      abertoMs: 1000,
      agora: () => agora,
    });
    const roteador = new Roteador(cadeia);
    for (let i = 0; i < 4; i++) await roteador.rotear(entrada('toalha'));
    expect(chamadas).toBe(2);
    expect(cadeia.status()[0]!.aberto).toBe(true);
    agora = 2000;
    await roteador.rotear(entrada('toalha'));
    expect(chamadas).toBe(3);
  });
});

describe('tradução e conhecimento', () => {
  it('alerta quando um número some na tradução', () => {
    expect(conferirNumeros('Exame realizado às 14h30 no quarto 302', 'Exam done at 14:30 in room 302')).toBeNull();
    expect(conferirNumeros('quarto 302', 'room 320')).toMatch(/302/);
  });

  it('detecta idioma', () => {
    expect(detectarIdioma('¿Dónde está la piscina?').idioma).toBe('es');
    expect(detectarIdioma('Where is the pool please').idioma).toBe('en');
    expect(detectarIdioma('Não tem água quente').idioma).toBe('pt');
    expect(detectarIdioma('sigo esperando, nadie vino').idioma).toBe('es');
    expect(detectarIdioma('ainda estou esperando, ninguém veio').idioma).toBe('pt');
  });

  it('respondedor sem IA só responde pergunta com uma tag', async () => {
    const itens = [
      { id: 'cafe', pergunta: 'Horário do café?', resposta: '6h30 às 10h30', tags: ['cafe', 'breakfast'] },
      { id: 'wifi', pergunta: 'Wi-Fi?', resposta: 'senha no cartão', tags: ['wifi'] },
    ];
    const r = new RespondedorPalavras();
    expect((await r.responder('Que horas é o café?', itens)).resposta).toBe('6h30 às 10h30');
    expect((await r.responder('Me traz um café no quarto', itens)).responde).toBe(false);
  });
});

describe('gasto com IA', () => {
  const resposta = (corpo: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

  it('pede o custo à OpenRouter e repassa tarefa, modelo, tokens e custo', async () => {
    const usos: UsoIA[] = [];
    let pedido: Record<string, unknown> = {};
    const f = (async (_url: string, init: RequestInit) => {
      pedido = JSON.parse(String(init.body));
      return resposta({ model: 'google/gemini', choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 120, completion_tokens: 30, cost: 0.000042 } })();
    }) as unknown as typeof fetch;
    const c = new ClienteOpenRouter({ apiKey: 'x', fetch: f, aoUsar: (u) => usos.push(u) });
    await c.chat({ modelo: 'google/gemini', mensagens: [{ role: 'user', content: 'oi' }], esquema: { nome: 'traducao', schema: {} } });
    expect(pedido.usage).toEqual({ include: true });
    expect(usos).toEqual([expect.objectContaining({ tarefa: 'traducao', modelo: 'google/gemini', tokensEntrada: 120, tokensSaida: 30, custoUsd: 0.000042, ok: true })]);
  });

  it('chamada que falha também é registrada, sem custo', async () => {
    const usos: UsoIA[] = [];
    const c = new ClienteOpenRouter({ apiKey: 'x', fetch: resposta({ error: 'x' }, 500), aoUsar: (u) => usos.push(u) });
    await expect(c.decisoes({ modelo: 'typesafe/jev', estado: 'x', perguntas: {} })).rejects.toThrow();
    expect(usos).toEqual([expect.objectContaining({ tarefa: 'decisoes', custoUsd: null, ok: false })]);
  });

  it('nomeia qualquer idioma para o modelo', () => {
    expect(nomeDoIdioma('ja')).toBe('Japanese');
    expect(nomeDoIdioma('pt')).toBe('Brazilian Portuguese');
    expect(nomeDoIdioma('ar')).toBe('Arabic');
  });
});

describe('tradução com reserva', () => {
  const falha: Tradutor = {
    disponivel: true,
    traduzir: async () => {
      throw new ErroMotor('indisponivel', 'OpenRouter 429: rate-limited upstream');
    },
    traduzirLote: async () => {
      throw new ErroMotor('indisponivel', 'OpenRouter 429');
    },
  };
  const reserva: Tradutor = {
    disponivel: true,
    traduzir: async (texto, para) => ({ texto: `[${para}] ${texto}`, idiomaOrigem: 'pt', modelo: 'reserva', alerta: null }),
    traduzirLote: async (textos, para) => textos.map((t) => `[${para}] ${t}`),
  };

  it('o principal falha e a reserva traduz na hora', async () => {
    const falhas: number[] = [];
    const t = new TradutorEmCadeia([falha, reserva], (i) => falhas.push(i));
    expect((await t.traduzir('Já estou subindo', 'en')).texto).toBe('[en] Já estou subindo');
    expect(await t.traduzirLote(['Enviar'], 'ja')).toEqual(['[ja] Enviar']);
    expect(falhas).toEqual([0, 0]);
  });

  it('se todos falham, o erro sobe (quem chama degrada: manda o original)', async () => {
    await expect(new TradutorEmCadeia([falha, falha]).traduzir('oi', 'en')).rejects.toThrow('429');
  });
});

describe('idioma de origem da tradução', () => {
  // O modelo devolve o texto igual (já está no destino) mas rotula a origem errado.
  const modelo = (traducao: string, origem: string) =>
    new ClienteOpenRouter({
      apiKey: 'x',
      fetch: (async () =>
        new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: JSON.stringify({ source_language: origem, translation: traducao }) } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch,
    });

  it('texto devolvido igual: a origem é o próprio destino, diga o modelo o que disser', async () => {
    const t = new TradutorLLM(modelo('Perfeito, e da piscina? Qual horário?', 'en'), 'm');
    expect((await t.traduzir('Perfeito, e da piscina ? Qual horário?', 'pt')).idiomaOrigem).toBe('pt');
  });

  it('texto traduzido de verdade: vale a origem informada', async () => {
    const t = new TradutorLLM(modelo('Perfect, and the pool? What time?', 'pt'), 'm');
    expect((await t.traduzir('Perfeito, e da piscina ? Qual horário?', 'en')).idiomaOrigem).toBe('pt');
  });
});
