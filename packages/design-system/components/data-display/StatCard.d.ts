import * as React from "react";

/** `coral` NAO faz parte do conjunto: coral e --live, reservado a processo com
 *  relogio correndo, e o valor de um StatCard e sempre um numero parado. */
export type StatAccent = "petrol" | "emerald" | "amber" | "crimson";

export interface StatTrend {
  /** Text shown in the pill (e.g. "+12%", "3.2k"). */
  value: React.ReactNode;
  /** Arrow direction. @default "flat" */
  direction?: "up" | "down" | "flat";
  /** Force the tone (green/red). When omitted, up = positive, down = negative.
   *  Set for inverted metrics (e.g. a falling wait time is good → direction "down", positive true). */
  positive?: boolean;
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Leading icon node (rendered in a tinted square). */
  icon?: React.ReactNode;
  /** Metric label (uppercase). */
  label?: React.ReactNode;
  /** The KPI value (large display type). */
  value?: React.ReactNode;
  /** Secondary helper text below the value. */
  hint?: React.ReactNode;
  /** Trend pill with arrow + colored tone. */
  trend?: StatTrend;
  /** Icon tint accent. @default "petrol" */
  accent?: StatAccent;
  /** A `Sparkline` (or any node) rendered at the bottom. Takes precedence over `sparklineData`. */
  sparkline?: React.ReactNode;
  /** Convenience: numbers to render an inline `Sparkline` (colored to match `accent`). */
  sparklineData?: number[];
  /** Override the inline sparkline color. */
  sparklineColor?: string;
  /** Add hover lift + pointer affordance (e.g. when clickable). @default false */
  interactive?: boolean;
}

export function StatCard(props: StatCardProps): React.JSX.Element;
