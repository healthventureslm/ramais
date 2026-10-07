import * as React from "react";

export interface DonutDatum {
  /** Slice label shown in the legend and tooltip. */
  label: string;
  /** Slice value (percentages are computed from the total). */
  value: number;
  /** Optional per-slice color override. */
  color?: string;
}

export interface DonutChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "data"> {
  /** Slices to render. */
  data?: DonutDatum[];
  /** Diameter in pixels. @default 180 */
  size?: number;
  /** Ring thickness in pixels. @default 22 */
  thickness?: number;
  /** Gap between slices, in degrees. @default 1.5 */
  gap?: number;
  /** Small caption under the center value. */
  centerLabel?: string;
  /** Center value. Defaults to the formatted total. */
  centerValue?: string | number;
  /** Show the legend below the ring. @default true */
  legend?: boolean;
  /** Format values for the center total and tooltips. */
  formatValue?: (value: number) => string;
}

export function DonutChart(props: DonutChartProps): React.JSX.Element;
