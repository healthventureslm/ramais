import * as React from "react";

/**
 * Text input with optional label, hint, error and inline icons.
 *
 * @startingPoint section="Forms" subtitle="Text fields, selects, toggles & checkboxes" viewport="700x320"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the control. */
  label?: React.ReactNode;
  /** Helper text shown below when there is no error. */
  hint?: React.ReactNode;
  /** Error message — turns the field into its invalid state. */
  error?: React.ReactNode;
  /** Show a coral asterisk next to the label. @default false */
  required?: boolean;
  /** Icon node pinned to the left inside the field. */
  iconLeft?: React.ReactNode;
  /** Icon node pinned to the right inside the field. */
  iconRight?: React.ReactNode;
}

export function Input(props: InputProps): React.JSX.Element;
