import * as React from "react";

/**
 * Slide-over panel from screen edge — for record details, filters, or
 * "cadastrar" forms that need more room than a Dialog. Portals to body,
 * animates in/out, Esc + overlay-click to close.
 */
export interface DrawerProps {
  open?: boolean;
  onClose?: () => void;
  /** Edge it slides from. @default "right" */
  side?: "right" | "left";
  /** Width preset. @default "md" */
  size?: "sm" | "md" | "lg" | "xl";
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small tracked label above the title. */
  eyebrow?: React.ReactNode;
  /** Icon node in a tinted square. */
  icon?: React.ReactNode;
  /** Footer slot — usually action buttons. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function Drawer(props: DrawerProps): React.JSX.Element | null;
