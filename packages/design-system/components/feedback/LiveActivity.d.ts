import * as React from "react";

/**
 * Pilula persistente de processo EM ANDAMENTO — a Now Bar do One UI, a Live
 * Activity do iOS. Um processo que continua correndo depois que a pessoa saiu
 * da tela onde ele comecou precisa continuar visivel, ou ela perde a nocao de
 * que ele existe.
 *
 * Nao pertence a nenhum produto: o componente so sabe que existe algo
 * correndo, ha quanto tempo, e como voltar para ele. Uma captura de audio, uma
 * higienizacao de leito e um chamado aberto usam a mesma peca.
 *
 * Se o processo NAO tem relogio correndo, este e o componente errado — estado
 * parado e `Banner` ou `Badge`.
 *
 * @startingPoint section="Feedback" subtitle="Processo em andamento" viewport="390x120"
 */
export interface LiveActivityProps extends React.HTMLAttributes<HTMLElement> {
  open?: boolean;
  /** O que esta acontecendo, em uma linha curta. */
  label?: React.ReactNode;
  /** Linha de apoio. Combina com o tempo decorrido quando ha `startedAt`. */
  meta?: React.ReactNode;
  /**
   * Instante em que o processo comecou. Com ele o componente conta o tempo
   * sozinho, que e o que faz a pilula parecer viva. O relogio so corre
   * enquanto `open` — intervalo ativo com a pilula fechada e bateria gasta
   * para atualizar o que ninguem ve.
   */
  startedAt?: Date | number | string;
  /** @default "live" */
  tone?: "live" | "brand" | "positive" | "warning";
  /**
   * `bottom` soma `--tabbar-height` sozinho; num produto sem TabBar o token
   * nao existe e ele encosta no rodape. @default "bottom"
   */
  anchor?: "bottom" | "top";
  /** Controles a direita — parar, pausar. Mantenha no maximo dois. */
  actions?: React.ReactNode;
  /** Com `onClick` a pilula vira `<button>` e leva de volta ao processo. */
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel?: string;
  container?: HTMLElement | React.RefObject<HTMLElement> | null;
  className?: string;
}

export function LiveActivity(props: LiveActivityProps): React.JSX.Element | null;

/** mm:ss, ou h:mm:ss quando passa da hora. Exportada porque o produto costuma
 *  precisar do mesmo formato fora da pilula. */
export function formatDuration(segundos: number): string;
