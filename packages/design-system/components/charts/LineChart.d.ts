import * as React from "react";

export interface LineSeries {
  /** Series label shown in the legend and tooltip. */
  name?: string;
  /** Stroke/area color. Defaults to a palette color based on index. */
  color?: string;
  /** Y values, one per x position. */
  data: number[];
}

export interface LineChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "data"> {
  /**
   * Nome acessivel do grafico. Sem ele o `role="img"` anuncia so
   * "imagem" e o dado inteiro some para quem usa leitor de tela.
   * Quando ausente, o componente monta um resumo a partir dos proprios
   * dados — pior que uma frase escrita por humano, muito melhor que
   * silencio.
   */
  label?: string;
  /** One or more series to plot. */
  series?: LineSeries[];
  /** Shortcut for a single unnamed series (alternative to `series`). */
  data?: number[];
  /** X-axis labels, one per data point. */
  labels?: string[];
  /** Chart height in pixels (width is responsive). @default 220 */
  height?: number;
  /** Fill the area under each line. @default false */
  area?: boolean;
  /** Show horizontal grid lines and Y labels. @default true */
  showGrid?: boolean;
  /** Render a dot at every data point. @default false */
  showDots?: boolean;
  /** Number of Y-axis ticks. @default 4 */
  yTicks?: number;
  /** Lower bound of the Y domain. Defaults to the data minimum. */
  min?: number;
  /** Upper bound of the Y domain. Defaults to the data maximum. */
  max?: number;
  /** Force the legend on/off. Defaults to on when any series has a `name`. */
  legend?: boolean;
  /** Format a Y value for axis labels and tooltips. */
  formatValue?: (value: number) => string;
  /** Format an X label. */
  formatLabel?: (label: string) => string;
}

export function LineChart(props: LineChartProps): React.JSX.Element;
