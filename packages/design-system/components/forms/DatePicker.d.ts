import * as React from "react";

export interface DatePickerPreset {
  /** Chip text. */
  label: React.ReactNode;
  /** Days from today — negative goes back. Ignored when `date` is given. */
  offset?: number;
  /** Explicit date, when an offset in days doesn't describe it. */
  date?: Date;
  key?: string;
}

/**
 * PT-BR date field (dd/mm/aaaa) you can type into.
 *
 * The control is an `<input>`, not a button that only opens the calendar: a
 * date the person already knows is faster typed than hunted for. Partial input
 * is completed from the month in view — `23` is the 23rd, `23/3` is 23 March
 * this year, `23/3/97` is 1997. Input that doesn't describe a real day reverts
 * to the previous value instead of clearing it.
 *
 * The calendar is still there, and follows along as you type. Its title steps
 * up from days to months to years, so a date years back is three clicks away.
 */
export interface DatePickerProps {
  /** @default "Hoje" */
  todayLabel?: string;
  /** @default "Limpar" */
  clearLabel?: string;
  /** Label of the button that opens the calendar. @default "Abrir calendário" */
  calendarLabel?: string;
  /**
   * Relative shortcuts shown as chips above the footer — "Ontem", "7 dias
   * atrás". The labels and offsets are the product's; the arithmetic is the
   * DS's. Omit for none.
   */
  presets?: DatePickerPreset[];

  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** @default "dd/mm/aaaa" */
  placeholder?: string;
  /** Controlled value. String is parsed per `valueFormat`; a Date is always accepted. */
  value?: string | Date;
  /** Initial value when uncontrolled. */
  defaultValue?: string | Date;
  /** Fires with the chosen date serialized per `valueFormat` ("" / null when cleared). */
  onChange?: (value: string | Date | null) => void;
  /**
   * How `value`/`defaultValue`/`min`/`max` are read and how `onChange` emits — display stays dd/mm/aaaa.
   * "br" (dd/mm/aaaa string) · "iso" (yyyy-mm-dd string, e.g. Supabase) · "date" (Date object).
   * @default "br"
   */
  valueFormat?: "br" | "iso" | "date";
  /** Earliest selectable date (parsed per `valueFormat`, or a Date). */
  min?: string | Date;
  /** Latest selectable date. */
  max?: string | Date;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function DatePicker(props: DatePickerProps): React.JSX.Element;
