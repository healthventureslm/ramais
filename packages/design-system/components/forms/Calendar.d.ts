import * as React from "react";

export interface CalendarCellProps {
  /** Extra class(es) for the day cell (e.g. `hv-date__cell--selected`). */
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

export interface CalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A date within the displayed month. */
  month: Date;
  /** Called with the first day of the previous/next month. */
  onMonthChange?: (month: Date) => void;
  /** Decorates each day cell. Receives the date and whether it's outside the current month. */
  getCellProps?: (date: Date, muted: boolean) => CalendarCellProps | undefined;
  /** Earliest reachable date — greys out whole months and years that fall outside. */
  min?: Date;
  /** Latest reachable date. */
  max?: Date;
  /** @default ["janeiro", …, "dezembro"] */
  monthNames?: string[];
  /** Weekday header, starting on Sunday. @default ["dom", …, "sáb"] */
  dayNames?: string[];
  /** @default "Anterior" */
  prevLabel?: string;
  /** @default "Próximo" */
  nextLabel?: string;
  /** Title button — steps up from days to months to years. @default "Trocar mês ou ano" */
  zoomLabel?: string;
}

/**
 * Shared month grid (header navigation + weekday row + day cells), PT-BR.
 *
 * The title is a button that steps up a level — days to months to years — so
 * reaching a date years back costs three clicks instead of one per month. The
 * grid is keyboard-driven: arrows move a day, PageUp/Down a month,
 * Shift+PageUp/Down a year, Home/End jump to the ends of the week.
 * Used internally by DatePicker, DateTimePicker and DateRangePicker — exported
 * so you can build custom date controls on the same grid.
 */
export function Calendar(props: CalendarProps): React.JSX.Element;
