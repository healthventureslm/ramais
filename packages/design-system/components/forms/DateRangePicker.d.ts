import * as React from "react";

export interface DateRangeValue {
  /** Start date, serialized per `valueFormat` ("" / null when none). */
  start: string | Date | null;
  /** End date, serialized per `valueFormat` ("" / null when none). */
  end: string | Date | null;
}

export interface DateRangePickerProps {
  /** @default "Limpar" */
  clearLabel?: string;
  /** @default "Aplicar" */
  applyLabel?: string;

  /** Field label. */
  label?: React.ReactNode;
  /** Helper text below the field. */
  hint?: React.ReactNode;
  /** Error message (replaces hint, marks invalid). */
  error?: React.ReactNode;
  required?: boolean;
  /** @default "dd/mm/aaaa – dd/mm/aaaa" */
  placeholder?: string;
  /** Controlled value `{ start, end }`. Strings are parsed per `valueFormat`; Dates always accepted. */
  value?: Partial<DateRangeValue>;
  /** Uncontrolled initial value. */
  defaultValue?: Partial<DateRangeValue>;
  /** Called with `{ start, end }` serialized per `valueFormat` when the range is applied. */
  onChange?: (value: DateRangeValue) => void;
  /**
   * How `value`/`defaultValue` are read and how `onChange` emits — display stays dd/mm/aaaa.
   * "br" (dd/mm/aaaa string) · "iso" (yyyy-mm-dd string) · "date" (Date object).
   * @default "br"
   */
  valueFormat?: "br" | "iso" | "date";
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function DateRangePicker(props: DateRangePickerProps): React.JSX.Element;
