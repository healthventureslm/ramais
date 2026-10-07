import * as React from "react";

export interface VoiceWaveformProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Nome do controle para leitor de tela quando `interactive`. Era uma
   * string literal dentro do JSX: o produto nao tinha como traduzir nem
   * ajustar, e a auditoria de copia nao alcancava (ela so olha
   * `aria-label="texto"` entre aspas, nao expressao JSX).
   */
  ariaLabel?: string;
  /** Optional array of numbers (values between 0 and 1) indicating each bar's amplitude height. */
  data?: number[];
  /** Number of bars to render. Ignored if custom `data` is provided. When omitted, the count auto-fills the container width (~1 bar per 5px) so the waveform stays dense at any size. */
  bars?: number;
  /** Height of the waveform container (number in pixels or CSS height string). @default 48 */
  height?: number | string;
  /** Playback progress fraction (value between 0 and 1). @default 0 */
  progress?: number;
  /** Active live recording state, which triggers coral colors and pulse animations. @default false */
  recording?: boolean;
  /** Active playing state. @default false */
  playing?: boolean;
  /** Enables hover selection states and click seeking. @default false */
  interactive?: boolean;
  /** Callback fired when user clicks to seek. Receives progress fraction (0 to 1). */
  onSeek?: (fraction: number) => void;
}

export function VoiceWaveform(props: VoiceWaveformProps): React.JSX.Element;
