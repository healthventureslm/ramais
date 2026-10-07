import * as React from "react";

/**
 * Compact status pill. `live` + `pulse` marks something HAPPENING NOW —
 * an audio capture, a bed turnover, an open call. Not one product's feature.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic colour. @default "neutral" */
  variant?: "neutral" | "positive" | "warning" | "danger" | "info" | "live" | "brand";
  /** Outlined instead of filled. @default false */
  outline?: boolean;
  /** Show a leading status dot. @default false */
  dot?: boolean;
  /** Pulsing dot. Use with `variant="live"` for a process still running. @default false */
  pulse?: boolean;
  /**
   * Renderiza um X que chama este handler. Existe porque o chip de ALERGIA e
   * removivel E e `danger` — ali a cor nao e categoria, e gravidade, entao
   * `Tag` (que proibe par semantico para categoria) nao cobre o caso.
   */
  onRemove?: () => void;
  /** @default "Remover" — compoe com o texto do badge no aria-label. */
  removeLabel?: string;
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): React.JSX.Element;
