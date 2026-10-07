import * as React from "react";

/**
 * Range slider with a live readout. Set `eva` for the 0–10 pain scale (EVA):
 * the fill + label shift emerald → amber → coral → crimson by intensity.
 */
export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> {
  /**
   * Nome acessivel quando `label` nao e string. O padrao anterior era a
   * palavra "slider" — nome de PAPEL, nao de controle: o leitor de tela
   * ja anuncia o papel, entao ouvia-se "slider, slider".
   * @default "Controle deslizante"
   */
  fallbackLabel?: string;
  /**
   * Nome acessivel quando `label` nao e string. O padrao antigo era a
   * palavra "slider" — nome de PAPEL, nao de controle: o leitor de tela ja
   * anuncia o papel, entao ele ouvia "slider, slider".
   * @default "Controle deslizante"
   */
  fallbackLabel?: string;
  label?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. */
  value?: number;
  /** Initial value when uncontrolled. */
  defaultValue?: number;
  /** Fires with the new numeric value. */
  onChange?: (value: number) => void;
  /** Unit shown after the value (e.g. "%", "mg"). */
  suffix?: string;
  /** Pain-scale mode: 0–10, colour-banded, with a severity label. @default false */
  eva?: boolean;
  /** Show min/mid/max tick labels. @default false */
  showTicks?: boolean;
  /** Explicit tick label values (overrides showTicks). */
  ticks?: (number | string)[];
  disabled?: boolean;
}

export function Slider(props: SliderProps): React.JSX.Element;
