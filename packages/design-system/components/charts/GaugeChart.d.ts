import * as React from "react";

export interface GaugeZone {
  /** Upper bound of this colored zone (in value units). */
  upTo: number;
  /** Zone color. */
  color: string;
  /** Optional label shown on hover. */
  label?: string;
}

export interface GaugeChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
  /**
   * Nome acessivel do grafico. Sem ele o `role="img"` anuncia so
   * "imagem" e o dado inteiro some para quem usa leitor de tela.
   * Quando ausente, o componente monta um resumo a partir dos proprios
   * dados — pior que uma frase escrita por humano, muito melhor que
   * silencio.
   */
  ariaLabel?: string;
  /** Current value. */
  value?: number;
  /** Minimum of the scale. @default 0 */
  min?: number;
  /** Maximum of the scale. @default 100 */
  max?: number;
  /** Diameter in pixels. @default 180 */
  size?: number;
  /** Arc thickness in pixels. @default 18 */
  thickness?: number;
  /** Fill color when no `segments` are provided. @default "var(--petrol-500)" */
  color?: string;
  /** Colored threshold zones across the scale. Drawn instead of a single fill. */
  segments?: GaugeZone[];
  /** Caption under the value. */
  label?: string;
  /** Format the center value. */
  formatValue?: (value: number) => string;
}

export function GaugeChart(props: GaugeChartProps): React.JSX.Element;
