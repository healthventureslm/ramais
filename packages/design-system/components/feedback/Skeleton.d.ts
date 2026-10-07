import * as React from "react";

/** Shimmering loading placeholder. Prefer over spinners for content. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Shape. @default "block" */
  variant?: "block" | "text" | "circle";
  /** CSS width (e.g. "120px", "60%"). */
  width?: string | number;
  /** CSS height. */
  height?: string | number;
  /** For variant="text": number of lines (last is shortened). @default 1 */
  lines?: number;
}

export function Skeleton(props: SkeletonProps): React.JSX.Element;
