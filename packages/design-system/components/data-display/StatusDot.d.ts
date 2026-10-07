import * as React from "react";

/** Coloured status dot + label. Used in tables and patient lists. */
export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Dot colour. @default "neutral" */
  status?: "neutral" | "positive" | "warning" | "danger" | "info" | "live";
  /** Pulsing ring — something in progress, whatever the product calls it. @default false */
  pulse?: boolean;
  children?: React.ReactNode;
}

export function StatusDot(props: StatusDotProps): React.JSX.Element;
