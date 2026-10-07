import * as React from "react";

export interface ToastAction {
  /** Button label. */
  label: React.ReactNode;
  /** Click handler. */
  onClick?: () => void;
}

/**
 * Transient notification. Position it yourself, or use `<ToastProvider>` +
 * the imperative `toast()` API for a managed bottom-right stack.
 */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Semantic colour + icon. @default "info" */
  variant?: "positive" | "warning" | "danger" | "info";
  /** Bold title line. */
  title?: React.ReactNode;
  /** Optional secondary message (children). */
  children?: React.ReactNode;
  /** Optional action below the message — a `{ label, onClick }` (rendered as a DS Button) or any node. */
  action?: ToastAction | React.ReactNode;
  /** When provided, renders a close button calling this handler. */
  onClose?: () => void;
}

export function Toast(props: ToastProps): React.JSX.Element;
