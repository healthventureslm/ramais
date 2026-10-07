import * as React from "react";

export interface SelectOption { value: string; label: React.ReactNode; }

/**
 * Custom dropdown select — a branded popover list (rounded, soft shadow, petrol
 * hover, check on the selected item) replacing the native OS dropdown.
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`).
 */
export interface SelectProps {
  /**
   * No mobile o dropdown vira sheet-picker. Um popover posicionado por
   * coordenada, com linhas de ~32px, e dificil de acertar com o polegar e pode
   * abrir fora da tela perto da borda; no sheet cada opcao vira uma linha de
   * 48px. @default true
   */
  responsive?: boolean;
  /** Titulo do sheet. Sem ele o sheet usa o `label` do campo. */
  sheetTitle?: React.ReactNode;
  /** Destino do portal do sheet — ver `Sheet`. */
  container?: HTMLElement | React.RefObject<HTMLElement> | null;

  /** @default "Nenhuma opção" */
  emptyLabel?: string;

  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Array of strings or {value,label} objects. */
  options?: (string | SelectOption)[];
  /** Placeholder shown when nothing is selected. @default "Selecione…" */
  placeholder?: string;
  /** Controlled selected value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Fires with the chosen option's `value`. */
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Select(props: SelectProps): React.JSX.Element;
