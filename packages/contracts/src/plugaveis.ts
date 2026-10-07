import type { ZodType } from 'zod';
import type { Recebe, Urgencia } from './comum.js';

/**
 * Contratos das peças plugáveis. Novas implementações entram por aqui,
 * sem mudar o motor da jornada.
 */

// ---------- Jornada ----------

export interface Contexto {
  orgId: string;
  unidadeId: string;
  solicitacaoId: string;
  idioma: string;
  vars: Record<string, unknown>;
}

export type EventoJornada =
  | { tipo: 'mensagem'; mensagemId: string; texto: string }
  | { tipo: 'timer'; nome: string }
  | { tipo: 'inicio' };

export type ResultadoBloco =
  | { acao: 'aguardar'; por: 'mensagem' | 'timer' }
  | { acao: 'avancar'; vars?: Record<string, unknown> }
  | { acao: 'encaminhar'; setorId: string }
  | { acao: 'humano'; motivo: string };

export interface Bloco<C> {
  tipo: string;
  schemaConfig: ZodType<C>;
  executar(ctx: Contexto, ev: EventoJornada, cfg: C): Promise<ResultadoBloco>;
}

/** Tenta de novo (falha transitória). */
export class ErroRecuperavel extends Error {
  override name = 'ErroRecuperavel';
}
/** Não adianta tentar de novo: a conversa vai para um humano. */
export class ErroFatal extends Error {
  override name = 'ErroFatal';
}

// ---------- Decisão ----------

export interface Pergunta {
  id: string;
  texto: string;
  /** Opções permitidas, já filtradas por permissão em código. */
  opcoes: string[];
  /** 'sim_nao' quando as opções são ['nao', 'sim'] (motores com tipo booleano nativo usam). */
  tipo?: 'escolha' | 'sim_nao';
  /** O que cada opção significa. Motores que recebem critérios por opção (Jev) usam. */
  descricoes?: Record<string, string>;
}

export interface RespostaDecisao {
  id: string;
  escolha: string;
  confianca: number;
  probs?: Record<string, number>;
}

export interface MotorDecisao {
  nome: string;
  decidir(r: { estado: string; perguntas: Pergunta[] }): Promise<{
    respostas: RespostaDecisao[];
    motor: string;
    latenciaMs: number;
  }>;
}

export class ErroMotor extends Error {
  constructor(
    readonly tipo: 'timeout' | 'indisponivel' | 'saida_invalida',
    message: string,
  ) {
    super(message);
    this.name = 'ErroMotor';
  }
}

// ---------- Ferramentas do agente ----------

export type NivelFerramenta = 'ler' | 'informar' | 'agir_baixo' | 'agir_risco';

export interface Ferramenta<I, O> {
  nome: string;
  descricao: string;
  nivel: NivelFerramenta;
  entrada: ZodType<I>;
  saida: ZodType<O>;
  executar(ctx: Contexto, i: I): Promise<O>;
}

// ---------- Conectores ----------

export interface RegistroCanonico {
  tipo: 'pessoa' | 'setor' | 'local' | 'vinculo';
  idExterno: string;
  dados: Record<string, unknown>;
}
export interface ConsultaCanonica {
  tipo: string;
  parametros: Record<string, unknown>;
}
export interface ResultadoCanonico {
  encontrado: boolean;
  dados?: Record<string, unknown>;
}
export interface Conector {
  nome: string;
  sincronizar?(desde: Date): AsyncIterable<RegistroCanonico>;
  consultar?(q: ConsultaCanonica): Promise<ResultadoCanonico>;
}

// ---------- Disponibilidade e distribuição ----------

export interface Candidato {
  pessoaId: string;
  recebe: Recebe;
  papel: 'membro' | 'supervisor';
  /** Conversas abertas somadas entre todos os setores. */
  carga: number;
  limiteCarga: number;
  idiomas: string[];
  /** Última vez que recebeu uma oferta (para desempate). */
  ultimaOfertaEm: Date | null;
}

export interface ItemFila {
  solicitacaoId: string;
  urgencia: Urgencia;
  entrouFilaEm: Date;
  idioma: string;
  /** Pessoas que já deixaram esta oferta expirar ou recusaram. */
  excluir: string[];
  /** Atendente anterior, para continuidade. */
  preferir?: string | null;
}

export interface ProvedorDisponibilidade {
  nome: string;
  disponiveis(setorId: string, t: Date): Promise<Candidato[]>;
}

export interface EstrategiaDistribuicao {
  nome: string;
  /** Pura e determinística. Devolve a pessoa escolhida ou null. */
  escolher(cands: Candidato[], item: ItemFila): string | null;
}

// ---------- Dashboard ----------

export interface Escopo {
  orgId: string;
  unidadeId: string;
  setorIds: string[] | 'todos';
}

export interface Cartao<D> {
  id: string;
  consultar(escopo: Escopo): Promise<D>;
  /** Eventos de tempo real que invalidam o cartão. */
  canais: string[];
}
