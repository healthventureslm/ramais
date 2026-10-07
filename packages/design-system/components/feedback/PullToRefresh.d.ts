import * as React from "react";

/**
 * Puxar o topo da lista para recarregar. Envolve o container que rola.
 *
 * O gesto so comeca com o scroll NO TOPO — sem essa regra ele rouba o scroll
 * no meio da lista e a pessoa nao consegue mais rolar para cima.
 *
 * @startingPoint section="Feedback" subtitle="Puxar para atualizar" viewport="390x400"
 */
export interface PullToRefreshProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pode devolver Promise — o disco fica girando ate ela resolver. */
  onRefresh?: () => void | Promise<unknown>;
  /** Distancia (ja com resistencia aplicada) para armar. @default 72 */
  threshold?: number;
  disabled?: boolean;
  /** Use quando o elemento que rola for seu, nao o interno. */
  scrollRef?: React.RefObject<HTMLElement>;
  /** @default "Atualizando…" */
  refreshingLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PullToRefresh(props: PullToRefreshProps): React.JSX.Element;
