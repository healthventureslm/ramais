import * as React from "react";

export interface SegmentOption {
  value: string;
  label: React.ReactNode;
  /** Leading icon node. */
  icon?: React.ReactNode;
  /** Trailing count pill. */
  count?: number;
  disabled?: boolean;
  /** Optional active color for this option (instead of the neutral white glider). */
  tone?: "positive" | "danger" | "warning" | "neutral" | "info";
}

/**
 * Compact single-choice toggle (segmented control) with a sliding glider —
 * for 2–4 short, mutually-exclusive options (e.g. view modes, filters).
 */
export interface SegmentedControlProps {
  options: (string | SegmentOption)[];
  /** Controlled selected value. */
  value?: string;
  defaultValue?: string;
  /** Fires with the chosen value. */
  onChange?: (value: string) => void;
  /** @default "md" */
  size?: "md" | "lg";
  /** Stretch to fill the container, equal-width segments. @default false */
  block?: boolean;
  /** Disable the whole control (all options non-interactive + dimmed). @default false */
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl(props: SegmentedControlProps): React.JSX.Element;
