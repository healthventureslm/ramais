import type { EstadoSolicitacao, Urgencia } from '@ramais/contracts';

/** Linha de `solicitacao` como vem do SQL (snake_case). */
export interface SolicitacaoRow {
  id: string;
  org_id: string;
  unidade_id: string;
  solicitante_id: string | null;
  canal_id: string | null;
  origem: 'externa' | 'interna';
  pai_id: string | null;
  criado_por: string | null;
  setor_id: string | null;
  responsavel_id: string | null;
  responsavel_anterior_id: string | null;
  local_id: string | null;
  identificado: boolean;
  estado: EstadoSolicitacao;
  etapa: string;
  idioma: string;
  urgencia: Urgencia;
  baixa_certeza: boolean;
  jornada_versao_id: string;
  contexto: Record<string, unknown>;
  versao: number;
  expiracoes: number;
  supervisor_notificado_em: Date | null;
  resumo: string | null;
  entrou_fila_em: Date | null;
  primeira_resposta_em: Date | null;
  ultima_msg_solicitante_em: Date | null;
  ultima_msg_equipe_em: Date | null;
  resolvida_em: Date | null;
  encerrada_em: Date | null;
  triagem: boolean;
  /** Conversa do simulador do construtor: não vai à Meta, à equipe nem às estatísticas. */
  teste: boolean;
  setor_sugerido_id: string | null;
  decisao_sugerida_id: string | null;
  /** Escada: desde quando o solicitante espera a equipe e desde quando o responsável atual tem a conversa. */
  espera_desde: Date | null;
  atendente_desde: Date | null;
  escada_feitos: string[];
  escada_proxima_em: Date | null;
  excluir_distribuicao: string[];
  criado_em: Date;
  atualizado_em: Date;
}

export type Ator = { tipo: 'pessoa'; id: string } | { tipo: 'sistema' } | { tipo: 'ia' } | { tipo: 'solicitante'; id: string | null };

export function atorTipo(a: Ator): 'pessoa' | 'sistema' | 'ia' | 'solicitante' {
  return a.tipo;
}
export function atorId(a: Ator): string | null {
  return a.tipo === 'pessoa' || a.tipo === 'solicitante' ? a.id : null;
}
