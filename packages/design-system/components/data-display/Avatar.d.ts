import * as React from "react";

/** Circular avatar — image or auto-initials with tonal fallback. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — used for initials and the title tooltip. */
  name?: string;
  /** Initials + a deterministic gradient hashed from this name (stable per name). Overrides `tone`. */
  fromName?: string;
  /** Image URL; falls back to initials when absent. */
  src?: string;
  /** Size. @default "md" */
  size?: "xs" | "sm" | "md" | "lg";
  /** Fallback colour tone 1–4. @default 1 */
  tone?: 1 | 2 | 3 | 4;
  /** Show a petrol ring (e.g. current user / on-call). @default false */
  ring?: boolean;
}

export function Avatar(props: AvatarProps): React.JSX.Element;
