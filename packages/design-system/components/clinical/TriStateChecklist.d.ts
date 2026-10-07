import * as React from "react";

export type TriStateTone = "positive" | "danger" | "warning" | "neutral" | "info";

export interface TriState {
  /** Stored value for this state. */
  value: string;
  /** Button label. */
  label: React.ReactNode;
  /** Active color. @default "info" */
  tone?: TriStateTone;
}

export interface TriStateItem {
  id?: string;
  label: React.ReactNode;
  /** Secondary description. */
  hint?: React.ReactNode;
}

export interface TriStateChecklistProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Checklist rows. */
  items?: TriStateItem[];
  /** Controlled answers keyed by item id (or index). */
  value?: Record<string, string>;
  /** Uncontrolled initial answers. */
  defaultValue?: Record<string, string>;
  /** Called with the updated answers. */
  onChange?: (values: Record<string, string>) => void;
  /** The states. @default Sim (positive) / Não (danger) / N/A (neutral) */
  states?: TriState[];
  /** Clicking the active state again clears it. @default true */
  allowClear?: boolean;
  /** Non-interactive + dimmed. @default false */
  disabled?: boolean;
  /** Non-interactive but full-contrast (for locked/read-only reports). @default false */
  readOnly?: boolean;
}

export function TriStateChecklist(props: TriStateChecklistProps): React.JSX.Element;
