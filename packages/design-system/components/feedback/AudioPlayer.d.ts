import * as React from "react";

export interface AudioPlayerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onPlay" | "onPause" | "onEnded"> {
  /** Nome do botao quando parado. @default "Reproduzir" */
  playLabel?: string;
  /** Nome do botao quando tocando. @default "Pausar" */
  pauseLabel?: string;
  /** URL of the audio file to play. */
  src: string;
  /** Optional precomputed waveform amplitudes (values between 0 and 1). When omitted, peaks are extracted from `src`. */
  data?: number[];
  /** Number of waveform bars to render. @default 48 */
  bars?: number;
  /** Optional track title shown above the waveform. */
  title?: string;
  /** Loop playback when the track ends. @default false */
  loop?: boolean;
  /** Automatically extract a waveform from `src` via the Web Audio API when no `data` is provided. @default true */
  autoPeaks?: boolean;
  /** Show the mute toggle button. @default true */
  showMute?: boolean;
  /** Render without the card chrome (no background, border, padding). @default false */
  bare?: boolean;
  /** Fired when playback starts. */
  onPlay?: (event: React.SyntheticEvent<HTMLAudioElement>) => void;
  /** Fired when playback pauses. */
  onPause?: (event: React.SyntheticEvent<HTMLAudioElement>) => void;
  /** Fired when playback reaches the end. */
  onEnded?: (event: React.SyntheticEvent<HTMLAudioElement>) => void;
}

export function AudioPlayer(props: AudioPlayerProps): React.JSX.Element;
