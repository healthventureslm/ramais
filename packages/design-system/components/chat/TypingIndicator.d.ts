import * as React from "react";

export interface TypingIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Accessible label announced by screen readers. @default "Digitando…" */
  label?: string;
  /** Render without the bubble background/border (just the dots). @default false */
  bare?: boolean;
}

export function TypingIndicator(props: TypingIndicatorProps): React.JSX.Element;
