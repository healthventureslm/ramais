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
 *
 * Resolvida só pela automação (a base respondeu e nenhum setor tocou nela, `setorId: null`)
 * não tem para quem reabrir: um pedido novo ("mande toalhas", um áudio, uma foto) abre outra
 * solicitação, que passa pelo roteamento. Só uma cortesia curta ("obrigado", "ok", "ありがとう")
 * fica na mesma: a base responde se souber, senão nada acontece, e a fila não recebe cortesia.
 * Na dúvida abre: pedido perdido custa mais que um "valeu" na fila.
 */
export function destinoNovaMensagem(
  aberta: { estado: EstadoSolicitacao; resolvidaEm: Date | null; setorId?: string | null } | null,
  agora: Date,
  reaberturaHoras: number,
  mensagem?: { texto: string | null; temMidia: boolean },
): 'continuar' | 'reabrir' | 'nova' {
  if (!aberta) return 'nova';
  if (aberta.estado === 'encerrada' || aberta.estado === 'cancelada') return 'nova';
  if (aberta.estado === 'resolvida') {
    if (!aberta.resolvidaEm) return 'nova';
    const horas = (agora.getTime() - aberta.resolvidaEm.getTime()) / 3_600_000;
    if (horas > reaberturaHoras) return 'nova';
    if (aberta.setorId === null && mensagem && (mensagem.temMidia || !ehCortesia(mensagem.texto ?? ''))) return 'nova';
    return 'reabrir';
  }
  return 'continuar';
}

// Escritas sem espaço entre palavras (japonês, chinês, coreano): a expressão sai inteira.
const CORTESIA_CJK = /(どうも)?ありがと(う)?(ございます|ございました)?|どうも|谢谢(你|您)?|謝謝|多谢|감사합니다|감사해요|고마워요?/gu;
// Fora da palavra (?<!\p{L}) … (?!\p{L}): "ok" não pode comer o começo de "okupado".
const CORTESIA_LATINA = new RegExp(
  '(?<!\\p{L})(obrigad[oa]s?|brigad[oa]|valeu|agrade[cç]\\p{L}*|thanks?|thank you|thx|ty|cheers|gracias|merci|danke|schön|schoen|grazie|arigat[oō]u?|' +
    'спасибо|شكرا|ok|okay|beleza|perfeito|[oó]timo|great|perfect|nice|legal|show|de nada|tudo (bem|certo)|' +
    // enchimento que acompanha o agradecimento
    'muito|mesmo|much|so|very|you|a|o|the|pela|pelo|por|ajuda|help|tudo|all|for|your|sir|senhor|senhora|again|lot|um|uma|bem|certo|' +
    'ent[aã]o|beaucoup|mil|mille|mucho|muchas|vielen|tante)(?!\\p{L})',
  'giu',
);

/**
 * Agradecimento ou concordância curta, em qualquer idioma comum: não é pedido novo.
 * Cortesia é o que, sem as expressões de cortesia e o enchimento, não deixa letra nenhuma:
 * "muito obrigado mesmo" e "ありがとうございます" são; "ok, chuveiro frio" e "タオルください" não.
 */
export function ehCortesia(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  if (!t || t.length > 60) return false;
  const resto = t.replace(CORTESIA_CJK, ' ').replace(CORTESIA_LATINA, ' ');
  return !/\p{L}/u.test(resto);
}
