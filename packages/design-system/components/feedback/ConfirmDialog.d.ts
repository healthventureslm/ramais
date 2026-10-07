import * as React from "react";

export interface ConfirmOptions {
  /** Heading. */
  title?: React.ReactNode;
  /** Explanatory text under the title. */
  description?: React.ReactNode;
  /** Confirm button label. @default "Confirmar" */
  confirmLabel?: React.ReactNode;
  /** Cancel button label. @default "Cancelar" */
  cancelLabel?: React.ReactNode;
  /** Destructive styling (red icon + danger confirm button). @default false */
  danger?: boolean;
  /** Override the header icon. Pass `null` to hide. Defaults to an alert icon when `danger`. */
  icon?: React.ReactNode;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  /** Whether the dialog is shown. @default true */
  open?: boolean;
  /** Show a spinner on the confirm button and lock the dialog (e.g. while the action runs). @default false */
  loading?: boolean;
  /** Called when the confirm button is clicked. */
  onConfirm?: () => void;
  /** Called when cancelled (button, overlay click or close). */
  onCancel?: () => void;
  /** Extra body content below the description. */
  children?: React.ReactNode;
  className?: string;
}

export function ConfirmDialog(props: ConfirmDialogProps): React.JSX.Element | null;

/**
 * Imperative confirmation. Returns `[confirm, element]`:
 * call `await confirm(options)` (resolves `true`/`false`) and render `element` once.
 *
 * ```tsx
 * const [confirm, confirmElement] = useConfirm();
 * const remove = async () => {
 *   if (await confirm({ title: "Excluir?", danger: true })) doRemove();
 * };
 * return <>{...}{confirmElement}</>;
 * ```
 */
export function useConfirm(): [
  (options?: ConfirmOptions) => Promise<boolean>,
  React.JSX.Element
];
