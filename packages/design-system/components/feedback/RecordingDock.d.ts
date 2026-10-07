import * as React from "react";

/**
 * Barra flutuante de uma captura que continua fora da tela onde começou.
 *
 * Vive acima das rotas: a pessoa começa a gravar, sai para ver um exame, e a
 * captura segue visível, pausável e finalizável de qualquer tela. Cobre o que
 * o `LiveActivity` não cobre — o DEPOIS da gravação: enquanto sobe e
 * transcreve, e quando o envio falha com o áudio ainda guardado.
 *
 * Não grava nada: o produto é dono do áudio e do relógio; o dock reflete a
 * fase e devolve os comandos. Cada ação só aparece se o handler vier.
 *
 * @startingPoint section="Feedback" subtitle="Captura assíncrona" viewport="900x600"
 */
export interface RecordingDockProps extends React.HTMLAttributes<HTMLElement> {
  /** `idle` esconde o dock, com a saída animada. @default "idle" */
  phase?: "idle" | "recording" | "paused" | "sending" | "failed";
  /** O que está sendo capturado — "Consulta · Maria Silva". */
  title?: React.ReactNode;
  /** Segundos gravados. Controlado: quem grava sabe quando o relógio parou. @default 0 */
  elapsed?: number;
  /** Teto da captura, em segundos. Vira "12:04 de 60:00". */
  limit?: number;
  /** Linha de apoio. Em `failed`, diga o que está guardado e o que fazer. */
  meta?: React.ReactNode;
  onPause?: () => void;
  onResume?: () => void;
  /** Finaliza e envia. */
  onStop?: () => void;
  /** Reenvia o áudio guardado depois de uma falha. */
  onRetry?: () => void;
  /** Volta para a tela da captura. Aparece em todas as fases. */
  onOpen?: () => void;
  /** @default "Gravando" */
  recordingLabel?: React.ReactNode;
  /** @default "Pausado" */
  pausedLabel?: React.ReactNode;
  /** @default "Enviando e transcrevendo…" */
  sendingLabel?: string;
  /** @default "Gravação não enviada" */
  failedLabel?: React.ReactNode;
  /** @default "Pausar" */
  pauseLabel?: string;
  /** @default "Retomar" */
  resumeLabel?: string;
  /** @default "Finalizar" */
  stopLabel?: string;
  /** @default "Reenviar" */
  retryLabel?: string;
  /** @default "Abrir" */
  openLabel?: string;
  /** Palavra entre o tempo e o teto. @default "de" */
  limitSeparator?: string;
  container?: HTMLElement | React.RefObject<HTMLElement> | null;
  className?: string;
}

export function RecordingDock(props: RecordingDockProps): React.JSX.Element | null;
