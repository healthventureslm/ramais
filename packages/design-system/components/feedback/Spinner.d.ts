import * as React from "react";

/** Indeterminate loading spinner. Reserve for in-button / async actions. */
export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** White variant for placement on petrol surfaces. @default false */
  onBrand?: boolean;
  /** Accessible label. @default "Carregando" */
  label?: string;
}

export function Spinner(props: SpinnerProps): React.JSX.Element;
