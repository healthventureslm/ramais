import * as React from "react";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatAttachment {
  /** File name shown in the chip. */
  name?: string;
  /** MIME type (e.g. "image/png", "application/pdf"). Images with a `url` render as thumbnails. */
  type?: string;
  /** Object URL or remote URL for image previews. */
  url?: string;
}

export interface ChatMessage {
  id?: string | number;
  /** @default "assistant" */
  role?: ChatRole;
  /** Message body (string or rich node). */
  content?: React.ReactNode;
  /** Attachments shown inside the bubble. */
  attachments?: ChatAttachment[];
}

export interface ChatSuggestion {
  /** Chip text. */
  label: string;
  /** Value sent on click (defaults to `label`). */
  value?: string;
}

export interface ChatComposerActionsApi {
  /** True while the composer is disabled (busy). */
  busy: boolean;
  /** Append files to the composer's pending attachments (same pipeline as the paperclip). */
  addFiles: (files: FileList | File[]) => void;
  /** Open the native attachment file picker. */
  openFilePicker: () => void;
}

export interface ChatProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Conversation, oldest first. */
  messages?: ChatMessage[];
  /** Called with the typed text and any attached files when the user sends. */
  onSend?: (text: string, files: File[]) => void;
  /** Override what happens when a suggestion chip is clicked (defaults to sending it). */
  onSuggestion?: (suggestion: ChatSuggestion) => void;
  /** Show the assistant "thinking" typing indicator (before the first token). @default false */
  pending?: boolean;
  /**
   * Mark the last assistant message as actively streaming — renders a blinking
   * cursor at the end of its bubble and keeps the log scrolled to the bottom as
   * tokens arrive. Keep updating that message's `content` with each chunk. @default false
   */
  streaming?: boolean;
  /** Disable the composer and suggestions (e.g. while a request is in flight). @default false */
  busy?: boolean;
  /** Quick-action suggestion chips above the composer. */
  suggestions?: ChatSuggestion[];
  /** Enable the attachment button (image/PDF by default). @default false */
  attachments?: boolean;
  /** `accept` for the file input. @default "image/*,application/pdf" */
  accept?: string;
  /**
   * Show a camera button that opens the device camera (`<input capture>`).
   * `true` → rear camera ("environment"); pass "user" for the front camera. @default false
   */
  capture?: boolean | "user" | "environment";
  /**
   * Called with captured photo(s). When omitted, captures are added to the pending
   * attachments like a normal file pick.
   */
  onCapture?: (files: File[]) => void;
  /**
   * Extra action buttons rendered in the composer row (e.g. DS `<IconButton>`s).
   * Pass a node, or a render function receiving `{ busy, addFiles, openFilePicker }`
   * so custom actions can feed files into the same attachment pipeline.
   */
  composerActions?: React.ReactNode | ((api: ChatComposerActionsApi) => React.ReactNode);
  /** Composer placeholder. */
  placeholder?: string;
  /** Optional header title. */
  title?: React.ReactNode;
  /** Optional header subtitle. */
  subtitle?: React.ReactNode;
  /** Override the assistant avatar node. */
  assistantAvatar?: React.ReactNode;
  /** Override the user avatar node. */
  userAvatar?: React.ReactNode;
  /** Node rendered on the right side of the header (e.g. an X/Y progress bar or counter). */
  headerExtra?: React.ReactNode;
  /** Side panel rendered to the right (e.g. a live schema preview). Switches to a split layout. */
  aside?: React.ReactNode;
  /** Shown in the empty log before the first message. */
  emptyState?: React.ReactNode;
}

export function Chat(props: ChatProps): React.JSX.Element;
