import * as React from "react";

export type ProgressBarVariant = "brand" | "positive" | "warning" | "danger";
export type ProgressBarSize = "xs" | "sm" | "md" | "lg";

export interface ProgressBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
  /** Current progress (0…`max`). Omit when `indeterminate`. */
  value?: number;
  /** Upper bound. @default 100 */
  max?: number;
  /** Semantic colour of the fill. @default "brand" */
  variant?: ProgressBarVariant;
  /** Track height. sm = 4px · md = 8px · lg = 12px. @default "md" */
  size?: ProgressBarSize;
  /** Caption shown above the track (also used as the accessible name when a string). */
  label?: React.ReactNode;
  /** Show the percentage (or `valueFormat`) on the right of the caption row. @default false */
  showValue?: boolean;
  /** Custom value text, e.g. `(v, max) => \`${v}/${max}\``. Defaults to a rounded percentage. */
  valueFormat?: (value: number, max: number) => React.ReactNode;
  /** Unknown-duration mode — renders a sweeping animation instead of a measured fill. @default false */
  indeterminate?: boolean;
  id?: string;
  className?: string;
}

export function ProgressBar(props: ProgressBarProps): React.JSX.Element;
