import * as React from "react";

export type TimelineStatus = "default" | "primary" | "positive" | "warning" | "danger" | "info";

export interface TimelineItem {
  /** Stable key. Falls back to the array index. */
  id?: string | number;
  /** Timestamp/label shown above the title (rendered in mono). */
  time?: React.ReactNode;
  /** Event title. */
  title?: React.ReactNode;
  /** Secondary description text. */
  description?: React.ReactNode;
  /** Accent color of the marker and (when present) the icon. @default "default" */
  status?: TimelineStatus;
  /** Icon node rendered inside the marker (e.g. an SVG). Without it, a small dot is shown. */
  icon?: React.ReactNode;
  /** Fill the marker with the status color (icon turns white). Only applies when `icon` is set. @default false */
  solid?: boolean;
  /** Extra content rendered below the description. */
  children?: React.ReactNode;
}

export type TimelineVariant = "default" | "alternate" | "horizontal";

export interface TimelineProps extends React.OlHTMLAttributes<HTMLOListElement> {
  /** Events to render, top to bottom (left to right when horizontal). */
  items?: TimelineItem[];
  /** Layout: vertical (`default`), zig-zag (`alternate`) or row of steps (`horizontal`). @default "default" */
  variant?: TimelineVariant;
  /** Density. `sm` renders a compact timeline. @default "md" */
  size?: "md" | "sm";
}

export function Timeline(props: TimelineProps): React.JSX.Element;
