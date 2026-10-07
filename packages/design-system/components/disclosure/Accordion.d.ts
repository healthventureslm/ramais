import * as React from "react";

export interface AccordionItem {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Leading icon node in a tinted square. */
  icon?: React.ReactNode;
  /** Right-aligned meta slot (e.g. a Badge or timestamp). */
  meta?: React.ReactNode;
  content: React.ReactNode;
}

/**
 * Expandable sections (e.g. patient-record panels). Smooth height transition,
 * petrol-tinted open header, single or multiple open at once.
 */
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  items: AccordionItem[];
  /** Allow several sections open at once. @default false */
  multiple?: boolean;
  /** id(s) open initially. */
  defaultOpen?: string | string[];
  /** Connected, borderless-between style. @default false */
  flush?: boolean;
}

export function Accordion(props: AccordionProps): React.JSX.Element;
