import * as React from "react";

export interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "type"> {
  /**
   * Nome acessivel do campo quando `label` nao e string (ou nao existe).
   * @default "Valor para copiar"
   */
  fallbackLabel?: string;
  /** Text copied to the clipboard. Como função, é lido na hora do clique. */
  value?: string | (() => string);
  /**
   * HTML a escrever no clipboard junto com o texto puro, no MESMO item —
   * quem cola em editor rico recebe a formatacao, quem cola em campo simples
   * recebe o texto. Sem contexto seguro (https/localhost) degrada para texto.
   */
  html?: string | (() => string | undefined);

  /** Idle label. @default "Copiar" */
  label?: React.ReactNode;
  /** Label shown briefly after copying. @default "Copiado" */
  copiedLabel?: React.ReactNode;
  /** Override the idle icon. */
  icon?: React.ReactNode;
  /** Render an icon-only button (composes IconButton instead of Button). @default false */
  iconOnly?: boolean;
  /** Button variant (`Button` variants when labeled, `IconButton` variants when `iconOnly`). */
  variant?: string;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** How long the copied state lasts, in ms. @default 1600 */
  timeout?: number;
  /** Called with the value after a successful copy. */
  onCopy?: (value: string) => void;
}

export function CopyButton(props: CopyButtonProps): React.JSX.Element;

export interface CopyFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onCopy"> {
  /** The value shown (mono, read-only) and copied. */
  value?: string;
  /**
   * HTML a escrever no clipboard junto com o texto puro, no MESMO item —
   * quem cola em editor rico recebe a formatacao, quem cola em campo simples
   * recebe o texto. Sem contexto seguro (https/localhost) degrada para texto.
   */
  html?: string;

  /** Field label. */
  label?: React.ReactNode;
  /** Helper text. */
  hint?: React.ReactNode;
  /** Error message. */
  error?: React.ReactNode;
  required?: boolean;
  /** Copy button aria-label. @default "Copiar" */
  copyLabel?: string;
  /** Copied aria-label. @default "Copiado" */
  copiedLabel?: string;
  /**
   * Chamado quando os tres caminhos de copia falham. Sem isso o clique nao da
   * retorno nenhum, e "achou que copiou" e o pior resultado possivel: a pessoa
   * troca de janela, cola no sistema do hospital e nao vem nada.
   */
  onError?: (e: unknown) => void;
  /** Rotulo mostrado no estado de falha. @default "Não foi possível copiar" */
  errorLabel?: string;

  /** Called with the value after a successful copy. */
  onCopy?: (value: string) => void;
  id?: string;
}

export function CopyField(props: CopyFieldProps): React.JSX.Element;
