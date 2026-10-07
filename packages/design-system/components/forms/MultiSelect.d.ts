import * as React from "react";

export interface MultiOption { value: string; label: string; }

/**
 * Multi-select with in-field tag chips. Type to filter, click/Enter to toggle,
 * Backspace removes the last chip. Checkbox-style branded popover.
 */
export interface MultiSelectProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  options?: (string | MultiOption)[];
  /** @default "Selecionar…" */
  placeholder?: string;
  /** Controlled array of selected values. */
  value?: string[];
  /** Initial values when uncontrolled. @default [] */
  defaultValue?: string[];
  /** Fires with the new array of selected values. */
  onChange?: (values: string[]) => void;
  /** Cap the number of selections. */
  maxTags?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function MultiSelect(props: MultiSelectProps): React.JSX.Element;
