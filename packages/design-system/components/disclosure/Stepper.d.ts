import * as React from "react";

export interface StepItem {
  id?: string;
  title: React.ReactNode;
  /** Secondary line under the title. */
  description?: React.ReactNode;
  /** Custom marker icon (replaces the number) for upcoming/current states. */
  icon?: React.ReactNode;
  /** Force a state instead of deriving from `current` (e.g. "error"). */
  state?: "done" | "current" | "upcoming" | "error";
}

/**
 * Multi-step progress indicator for wizards/onboarding (e.g. cadastrar hospital).
 * Horizontal or vertical, with done/current/upcoming/error states.
 *
 * @startingPoint section="Navigation" subtitle="Wizard progress steps" viewport="700x140"
 */
export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: StepItem[];
  /** Index of the active step; earlier steps render as done. @default 0 */
  current?: number;
  /** Layout. @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Makes completed/current steps clickable; fires with the step index. */
  onStepClick?: (index: number) => void;
}

export function Stepper(props: StepperProps): React.JSX.Element;
