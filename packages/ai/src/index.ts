import type { MotorDecisao, SetorCatalogo } from '@ramais/contracts';
import { CadeiaMotores } from './cadeia.js';
import { RespondedorLLM, RespondedorPalavras, type Respondedor } from './conhecimento.js';
import { MultimodalLLM, MultimodalNulo, type Multimodal } from './midia.js';
import { MotorLLM } from './motor-llm.js';
import { MotorPalavras } from './motor-palavras.js';
import { MotorJev, ehModeloDeDecisao } from './motor-jev.js';
import { ClienteOpenRouter, type ClienteChat, type ClienteDecisoes, type UsoIA } from './openrouter.js';
import { Roteador } from './roteador.js';
import { TradutorLLM, TradutorNulo, type Tradutor, TradutorEmCadeia } from './tradutor.js';

export * from './openrouter.js';
export * from './motor-llm.js';
export * from './motor-jev.js';
export * from './motor-palavras.js';
export * from './cadeia.js';
export * from './roteador.js';
export * from './tradutor.js';
export * from './conhecimento.js';
export * from './midia.js';
export * from './idioma.js';

export interface ConfigIA {
  apiKey?: string | null;
  semRetencao?: boolean;
  modeloRoteamento: string;
  modeloRoteamentoAlternativo?: string | null;
  modeloTraducao: string;
  /** Reserva da tradução: usado na hora em que o principal falhar. Vazio = sem reserva. */
  modeloTraducaoAlternativo?: string | null;
  modeloResposta: string;
  modeloMultimodal: string;
  metodoConfianca: 'logprobs' | 'autoconsistencia';
  amostras?: number;
  cliente?: ClienteChat & Partial<ClienteDecisoes>;
  aoFalhar?: (motor: string, erro: unknown) => void;
  /** Cada chamada à OpenRouter, com custo, para medir gasto. */
  aoUsar?: (u: UsoIA) => void;
}

export interface ServicosIA {
  /** Cria o roteador para o catálogo de uma unidade (o motor de regras depende do catálogo). */
  roteador(setores: Pick<SetorCatalogo, 'chave' | 'palavrasChave'>[]): Roteador;
  tradutor: Tradutor;
  respondedor: Respondedor;
  multimodal: Multimodal;
  comIA: boolean;
}

/**
 * Monta os serviços de IA. Sem chave do OpenRouter, tudo cai para regras:
 * o sistema funciona, só que sem tradução e com roteamento por palavra-chave.
 */
export function criarServicosIA(c: ConfigIA): ServicosIA {
  const cliente = c.cliente ?? (c.apiKey ? new ClienteOpenRouter({ apiKey: c.apiKey, semRetencao: c.semRetencao, aoUsar: c.aoUsar }) : null);
  if (!cliente) {
    return {
      roteador: (setores) => new Roteador(new MotorPalavras(setores)),
      tradutor: new TradutorNulo(),
      respondedor: new RespondedorPalavras(),
      multimodal: new MultimodalNulo(),
      comIA: false,
    };
  }
  const principal = criarMotorRoteamento(cliente, c.modeloRoteamento, c.metodoConfianca, c.amostras);
  const alternativo = c.modeloRoteamentoAlternativo
    ? criarMotorRoteamento(cliente, c.modeloRoteamentoAlternativo, 'autoconsistencia', c.amostras)
    : null;
  // A cadeia de LLMs é uma só para o disjuntor valer para o provedor todo, entre unidades.
  // O motor de regras depende do catálogo, então fica numa cadeia externa por unidade.
  const llms = new CadeiaMotores([principal, ...(alternativo ? [alternativo] : [])], { aoFalhar: c.aoFalhar });
  return {
    roteador: (setores) =>
      new Roteador(
        new CadeiaMotores([llms, new MotorPalavras(setores)], { falhasParaAbrir: Number.MAX_SAFE_INTEGER, aoFalhar: c.aoFalhar }),
      ),
    tradutor:
      c.modeloTraducaoAlternativo && c.modeloTraducaoAlternativo !== c.modeloTraducao
        ? new TradutorEmCadeia([new TradutorLLM(cliente, c.modeloTraducao), new TradutorLLM(cliente, c.modeloTraducaoAlternativo)], (i, e) =>
            c.aoFalhar?.(i === 0 ? `tradução ${c.modeloTraducao}` : `tradução ${c.modeloTraducaoAlternativo}`, e),
          )
        : new TradutorLLM(cliente, c.modeloTraducao),
    respondedor: new RespondedorLLM(cliente, c.modeloResposta),
    multimodal: new MultimodalLLM(cliente, c.modeloMultimodal),
    comIA: true,
  };
}

/**
 * Motor de roteamento para um modelo: o Jev (TypeSafe) vai pela Decisions API, com confiança
 * nativa; os demais, por chat completions com logprobs ou autoconsistência.
 */
export function criarMotorRoteamento(
  cliente: ClienteChat & Partial<ClienteDecisoes>,
  modelo: string,
  metodo: 'logprobs' | 'autoconsistencia',
  amostras?: number,
): MotorDecisao {
  if (ehModeloDeDecisao(modelo)) {
    if (!cliente.decisoes) throw new Error(`o cliente não suporta a Decisions API (${modelo})`);
    return new MotorJev({ cliente: cliente as ClienteDecisoes, modelo });
  }
  return new MotorLLM({ cliente, modelo, metodo, amostras });
}
