import * as React from "react";

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Extra searchable text (not shown). */
  keywords?: string;
}

/**
 * Searchable single-select — type to filter a long list (e.g. medication
 * catalogue), with match highlighting, keyboard nav and a clear button.
 * Branded popover, not the native dropdown.
 */
export interface ComboboxProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  options?: (string | ComboOption)[];
  /** @default "Buscar…" */
  placeholder?: string;
  /** Controlled selected value. */
  value?: string;
  defaultValue?: string;
  /** Fires with the chosen value ("" when cleared). */
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Show a clear (×) button when a value is selected. @default true */
  clearable?: boolean;
  id?: string;
  className?: string;
}

export function Combobox(props: ComboboxProps): React.JSX.Element;
