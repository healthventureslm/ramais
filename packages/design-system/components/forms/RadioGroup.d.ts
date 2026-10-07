import * as React from "react";

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Single-choice radio list. `variant="cards"` renders each option as a
 * selectable card (petrol border + tint when chosen) for richer choices.
 */
export interface RadioGroupProps {
  /** Group legend. */
  label?: React.ReactNode;
  /** Shared input name (auto-generated if omitted). */
  name?: string;
  options: (string | RadioOption)[];
  /** Controlled selected value. */
  value?: string;
  defaultValue?: string;
  /** Fires with the chosen value. */
  onChange?: (value: string) => void;
  /**
   * Mensagem de erro. Marca o controle (borda vermelha + `aria-invalid`) e
   * imprime o texto abaixo. Existe porque "aceito os termos" e o caso
   * classico de campo obrigatorio que nao tinha como reclamar.
   */
  error?: React.ReactNode;
  /** Asterisco no rotulo e `aria-required` no controle. @default false */
  required?: boolean;
  /** "default" rows or "cards". @default "default" */
  variant?: "default" | "cards";
  disabled?: boolean;
  className?: string;
}

export function RadioGroup(props: RadioGroupProps): React.JSX.Element;
