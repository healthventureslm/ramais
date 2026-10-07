import * as React from "react";

export interface ChatWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state. Omit to use `defaultOpen` (uncontrolled). */
  open?: boolean;
  /** Initial open state when uncontrolled. @default false */
  defaultOpen?: boolean;
  /** Called when the open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Panel header title. */
  title?: React.ReactNode;
  /** Panel header subtitle. */
  subtitle?: React.ReactNode;
  /** Unread indicator on the launcher (hidden while open). */
  unread?: boolean | number | string;
  /** Optional text label on the launcher button. */
  launcherLabel?: React.ReactNode;
  /** Override the launcher icon. */
  launcherIcon?: React.ReactNode;
  /** Placement. @default "bottom-right" */
  position?: "bottom-right" | "bottom-left";
  /** Panel width in px. @default 370 */
  width?: number;
  /** Panel height in px. @default 540 */
  height?: number;
  /** Panel content (e.g. a `Chat`, or `ChatBubble`s + `ChatComposer`). */
  children?: React.ReactNode;
}

export function ChatWidget(props: ChatWidgetProps): React.JSX.Element;
