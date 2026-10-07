import * as React from "react";

/** Checkbox with optional label and description. */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  /**
   * Mensagem de erro. Marca o controle (borda vermelha + `aria-invalid`) e
   * imprime o texto abaixo. Existe porque "aceito os termos" e o caso
   * classico de campo obrigatorio que nao tinha como reclamar.
   */
  error?: React.ReactNode;
  /** Asterisco no rotulo e `aria-required` no controle. @default false */
  required?: boolean;
}

export function Checkbox(props: CheckboxProps): React.JSX.Element;
