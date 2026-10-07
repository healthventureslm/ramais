import * as React from "react";

export interface ChatLauncherProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Nome acessivel quando fechado. @default "Abrir chat" */
  openLabel?: string;
  /** Nome acessivel quando aberto. @default "Fechar chat" */
  closeLabel?: string;
  /** Click handler (toggle the chat). */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Open state — swaps the icon to a close glyph and hides the unread badge. @default false */
  open?: boolean;
  /** Optional text label (turns the round FAB into a pill). */
  label?: React.ReactNode;
  /** Unread indicator: `true` shows a dot; a number/string shows a counter. */
  unread?: boolean | number | string;
  /** Override the icon. Defaults to a chat glyph (or a close glyph when `open`). */
  icon?: React.ReactNode;
  /** Size. @default "md" */
  size?: "sm" | "md";
  /** Placement. `bottom-right`/`bottom-left` render fixed; `inline` flows normally. @default "bottom-right" */
  position?: "bottom-right" | "bottom-left" | "inline";
}

export function ChatLauncher(props: ChatLauncherProps): React.JSX.Element;
