import * as React from "react";

export interface BarDatum {
  /** Category label shown under the bar. */
  label: string;
  /** Bar value. */
  value: number;
  /** Optional per-bar color override. */
  color?: string;
}

export interface BarChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "data"> {
  /** Bars to render. */
  data?: BarDatum[];
  /** Chart height in pixels (width is responsive). @default 220 */
  height?: number;
  /** Upper bound of the Y domain. Defaults to the largest value. */
  max?: number;
  /** Show horizontal grid lines and Y labels. @default true */
  showGrid?: boolean;
  /** Number of Y-axis ticks. @default 4 */
  yTicks?: number;
  /** Default bar color (overridden per datum by `color`). @default "var(--petrol-500)" */
  barColor?: string;
  /** Format a value for axis labels and tooltips. */
  formatValue?: (value: number) => string;
}

export function BarChart(props: BarChartProps): React.JSX.Element;
