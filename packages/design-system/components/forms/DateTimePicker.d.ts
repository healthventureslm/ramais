import * as React from "react";

export interface DateTimePickerProps {
  /** @default "Horário" */
  timeLabel?: string;
  /** @default "Agora" */
  nowLabel?: string;
  /** @default "Aplicar" */
  applyLabel?: string;

  /** Field label. */
  label?: React.ReactNode;
  /** Helper text below the field. */
  hint?: React.ReactNode;
  /** Error message (replaces hint, marks invalid). */
  error?: React.ReactNode;
  required?: boolean;
  /** @default "dd/mm/aaaa --:--" */
  placeholder?: string;
  /** Controlled value. String is parsed per `valueFormat`; a Date is always accepted. */
  value?: string | Date;
  /** Uncontrolled initial value (string per `valueFormat`, or a Date). */
  defaultValue?: string | Date;
  /** Called with the chosen instant serialized per `valueFormat` ("" / null when cleared). */
  onChange?: (value: string | Date | null) => void;
  /**
   * How `value`/`defaultValue` are read and how `onChange` emits — display stays dd/mm/aaaa HH:mm.
   * "br" ("dd/mm/aaaa HH:mm") · "iso" ("yyyy-mm-ddTHH:mm") · "date" (Date object).
   * @default "br"
   */
  valueFormat?: "br" | "iso" | "date";
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function DateTimePicker(props: DateTimePickerProps): React.JSX.Element;
