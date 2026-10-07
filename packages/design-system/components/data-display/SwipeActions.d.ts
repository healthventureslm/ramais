import * as React from "react";

/**
 * Arrastar uma linha para revelar acoes — o gesto do Telegram e do Mail.
 * No mobile nao ha hover, e pendurar um menu de reticencias em toda linha
 * enche a lista de ruido.
 *
 * @startingPoint section="Data display" subtitle="Acoes por arraste" viewport="390x200"
 */
export interface SwipeActionItem {
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "brand" | "positive" | "warning" | "danger";
  onSelect?: (id?: string) => void;
}

export interface SwipeActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A PRIMEIRA acao e a que dispara no arraste longo — coloque a mais comum ali. */
  actions?: SwipeActionItem[];
  /** De que lado as acoes ficam. @default "end" */
  side?: "start" | "end";
  /**
   * Arraste longo dispara a primeira acao sem soltar num botao — e o que torna
   * "arquivar" um gesto so, em vez de arrastar-e-mirar. Desligue quando a
   * primeira acao for destrutiva e irreversivel. @default true
   */
  fullSwipe?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SwipeActions(props: SwipeActionsProps): React.JSX.Element;
