import type { EstadoSolicitacao } from '@ramais/contracts';

export type AcaoEstado =
  | 'entrar_fila'
  | 'ofertar'
  | 'aceitar'
  | 'pegar'
  | 'expirar_oferta'
  | 'transferir'
  | 'aguardar_solicitante'
  | 'solicitante_respondeu'
  | 'resolver'
  | 'reabrir'
  | 'encerrar'
  | 'cancelar';

/**
 * Máquina de estados da solicitação.
 *
 *   automacao → na_fila → oferecida → em_atendimento ⇄ aguardando_solicitante → resolvida → encerrada
 *   cancelada: o solicitante encerra antes de ser atendido.
 */
const TRANSICOES: Record<AcaoEstado, Partial<Record<EstadoSolicitacao, EstadoSolicitacao>>> = {
  entrar_fila: { automacao: 'na_fila' },
  ofertar: { na_fila: 'oferecida' },
  aceitar: { oferecida: 'em_atendimento' },
  // Supervisor pega direto da fila ou de uma oferta pendente.
  pegar: { na_fila: 'em_atendimento', oferecida: 'em_atendimento' },
  expirar_oferta: { oferecida: 'na_fila' },
  transferir: {
    na_fila: 'na_fila',
    oferecida: 'na_fila',
    em_atendimento: 'na_fila',
    aguardando_solicitante: 'na_fila',
    automacao: 'na_fila',
  },
  aguardar_solicitante: { em_atendimento: 'aguardando_solicitante' },
  solicitante_respondeu: { aguardando_solicitante: 'em_atendimento' },
  resolver: {
    automacao: 'resolvida',
    em_atendimento: 'resolvida',
    aguardando_solicitante: 'resolvida',
  },
  reabrir: { resolvida: 'na_fila' },
  encerrar: {
    resolvida: 'encerrada',
    em_atendimento: 'encerrada',
    aguardando_solicitante: 'encerrada',
  },
  cancelar: { automacao: 'cancelada', na_fila: 'cancelada', oferecida: 'cancelada' },
};

export class ErroTransicao extends Error {
  constructor(
    readonly estado: EstadoSolicitacao,
    readonly acao: AcaoEstado,
  ) {
    super(`transição inválida: ${acao} a partir de ${estado}`);
    this.name = 'ErroTransicao';
  }
}

export function transicionar(estado: EstadoSolicitacao, acao: AcaoEstado): EstadoSolicitacao {
  const destino = TRANSICOES[acao][estado];
  if (!destino) throw new ErroTransicao(estado, acao);
  return destino;
}

export function podeTransicionar(estado: EstadoSolicitacao, acao: AcaoEstado): boolean {
  return TRANSICOES[acao][estado] !== undefined;
}

/** Estados de onde vale a pena encerrar quando o solicitante pede para sair. */
export function acaoParaEncerrarPeloSolicitante(estado: EstadoSolicitacao): AcaoEstado | null {
  if (podeTransicionar(estado, 'cancelar')) return 'cancelar';
  if (podeTransicionar(estado, 'encerrar')) return 'encerrar';
  return null;
}

/**
 * Nova mensagem de um solicitante: continua a solicitação aberta, reabre a resolvida
 * dentro da janela ou abre uma nova.
 */
export function destinoNovaMensagem(
  aberta: { estado: EstadoSolicitacao; resolvidaEm: Date | null } | null,
  agora: Date,
  reaberturaHoras: number,
): 'continuar' | 'reabrir' | 'nova' {
  if (!aberta) return 'nova';
  if (aberta.estado === 'encerrada' || aberta.estado === 'cancelada') return 'nova';
  if (aberta.estado === 'resolvida') {
    if (!aberta.resolvidaEm) return 'nova';
    const horas = (agora.getTime() - aberta.resolvidaEm.getTime()) / 3_600_000;
    return horas <= reaberturaHoras ? 'reabrir' : 'nova';
  }
  return 'continuar';
}
