import * as React from "react";

export interface ScoreOption {
  /** Numeric points for this choice. */
  value: number;
  /** Choice text. */
  label: React.ReactNode;
}

export interface ScoredScaleItem {
  id?: string;
  label: React.ReactNode;
  /** Secondary description. */
  hint?: React.ReactNode;
  /** Discrete scored choices → rendered as a select. */
  options?: ScoreOption[];
  /** When no `options`, renders a numeric input with these bounds. */
  min?: number;
  max?: number;
  step?: number;
}

export type ScoreTone = "danger" | "warning" | "positive" | "info" | "neutral";

export interface ScoreRange {
  /** Inclusive lower bound (omit for open-ended). */
  min?: number;
  /** Inclusive upper bound (omit for open-ended). */
  max?: number;
  /** Classification text shown as a badge. */
  label: React.ReactNode;
  /** Badge color. @default "neutral" */
  tone?: ScoreTone;
}

export interface ScoredScaleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Scale rows. */
  items?: ScoredScaleItem[];
  /** Controlled scores keyed by item id (or index). */
  value?: Record<string, number | "">;
  /** Uncontrolled initial scores. */
  defaultValue?: Record<string, number | "">;
  /** Called with the updated scores and the new total. */
  onChange?: (values: Record<string, number | "">, total: number) => void;
  /** Classification bands by total range (first match wins). */
  ranges?: ScoreRange[];
  /** Maximum total (shown as “/ max”). Inferred from items when omitted. */
  max?: number;
  /** Label for the total row. @default "Total" */
  totalLabel?: React.ReactNode;
  /** Non-interactive + dimmed (composes the Select/Input disabled state). @default false */
  disabled?: boolean;
  /** Non-interactive but full-contrast (for locked/read-only reports). @default false */
  readOnly?: boolean;
}

export function ScoredScale(props: ScoredScaleProps): React.JSX.Element;
