import * as React from "react";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional leading icon node. */
  icon?: React.ReactNode;
  /** Optional count pill (e.g. pending items). */
  count?: number;
}

/** Underlined tab bar. Controlled (`value`) or uncontrolled (`defaultValue`). */
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TabItem[];
  /** Controlled active value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Fires with the newly selected value. */
  onChange?: (value: string) => void;
}

export function Tabs(props: TabsProps): React.JSX.Element;
