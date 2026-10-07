import * as React from "react";

export type ChatBubbleRole = "user" | "assistant" | "system";

export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Bubble side/style. @default "assistant" */
  role?: ChatBubbleRole;
  /** Override the avatar node. Pass `null` to hide. Defaults to a role icon. */
  avatar?: React.ReactNode;
  /** Optional name shown above the bubble. */
  name?: React.ReactNode;
  /** Optional timestamp shown above the bubble. */
  time?: React.ReactNode;
  /** Show the avatar. @default true */
  showAvatar?: boolean;
  /** Bubble content. */
  children?: React.ReactNode;
}

export function ChatBubble(props: ChatBubbleProps): React.JSX.Element;
