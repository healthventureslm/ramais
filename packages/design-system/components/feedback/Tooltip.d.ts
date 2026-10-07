import * as React from "react";

/** Hover/focus tooltip wrapping a single trigger element. */
export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "content"> {
  /** Tooltip content. */
  content: React.ReactNode;
  /** Placement. @default "top" */
  side?: "top" | "bottom" | "left" | "right";
  /** The trigger element. */
  children: React.ReactNode;
}

export function Tooltip(props: TooltipProps): React.JSX.Element;
