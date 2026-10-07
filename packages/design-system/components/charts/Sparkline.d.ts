import * as React from "react";

export interface SparklineProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "data"> {
  /**
   * Nome acessivel do grafico. Sem ele o `role="img"` anuncia so
   * "imagem" e o dado inteiro some para quem usa leitor de tela.
   * Quando ausente, o componente monta um resumo a partir dos proprios
   * dados — pior que uma frase escrita por humano, muito melhor que
   * silencio.
   */
  label?: string;
  /** Y values to plot as a compact trend line. */
  data?: number[];
  /** Height in pixels (width is responsive). @default 36 */
  height?: number;
  /** Line/area color. @default "var(--petrol-500)" */
  color?: string;
  /** Fill the area under the line. @default false */
  area?: boolean;
  /** Show a dot on the last point when not hovering. @default true */
  showDot?: boolean;
  /** Lower bound of the Y domain. Defaults to the data minimum. */
  min?: number;
  /** Upper bound of the Y domain. Defaults to the data maximum. */
  max?: number;
  /** Enable hover to reveal the nearest point and its value. @default true */
  interactive?: boolean;
  /** Format a value for the hover tooltip. */
  formatValue?: (value: number) => string;
}

export function Sparkline(props: SparklineProps): React.JSX.Element;
