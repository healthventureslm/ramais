import * as React from "react";
import { ToastAction } from "./Toast";

export type ToastPosition =
  | "bottom-right" | "bottom-left" | "bottom-center"
  | "top-right" | "top-left" | "top-center";

/** Imperative alias variants. Mapped to Toast visual variants (success→positive, error→danger). */
export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  /** Bold title line. */
  title?: React.ReactNode;
  /** Secondary message under the title. */
  description?: React.ReactNode;
  /** Semantic variant. @default "info" */
  variant?: ToastVariant;
  /** Auto-dismiss in ms. Omit to use the provider default; `0` / `Infinity` keeps it sticky. */
  duration?: number;
  /** Optional action button — `{ label, onClick }`. */
  action?: ToastAction;
  /** Provide to update an existing toast or control dismissal. Auto-generated otherwise. */
  id?: string | number;
}

export interface ToastFn {
  /** Show a toast. Pass a string (title only) or an options object. Returns the toast id. */
  (opts: string | ToastOptions): string | number;
  success(title: React.ReactNode, opts?: Omit<ToastOptions, "title" | "variant">): string | number;
  error(title: React.ReactNode, opts?: Omit<ToastOptions, "title" | "variant">): string | number;
  warning(title: React.ReactNode, opts?: Omit<ToastOptions, "title" | "variant">): string | number;
  info(title: React.ReactNode, opts?: Omit<ToastOptions, "title" | "variant">): string | number;
  /** Dismiss a toast by id, or all when called with no argument. */
  dismiss(id?: string | number): void;
}

/** Imperative toast API — call from anywhere; requires a mounted `<ToastProvider>`. */
export const toast: ToastFn;

export interface ToastProviderProps {
  /** Where the stack anchors. @default "bottom-right" */
  position?: ToastPosition;
  /** Default auto-dismiss in ms (per-toast `duration` overrides). @default 5000 */
  duration?: number;
  /** Cap the number of visible toasts (keeps the newest). */
  max?: number;
  className?: string;
}

/** Renders the managed toast stack. Mount once near the app root. */
export function ToastProvider(props: ToastProviderProps): React.JSX.Element;
