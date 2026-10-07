import * as React from "react";

export interface ChatComposerSuggestion {
  label: string;
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

export interface ChatComposerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Called with the typed text and any attached files when the user sends. */
  onSend?: (text: string, files: File[]) => void;
  /** Disable the input and buttons. @default false */
  busy?: boolean;
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
  /** Input placeholder. */
  placeholder?: string;
  /** Quick-action suggestion chips above the input. */
  suggestions?: ChatComposerSuggestion[];
  /** Override what a suggestion click does (defaults to sending it). */
  onSuggestion?: (suggestion: ChatComposerSuggestion) => void;
  /** Focus the input on mount. @default false */
  autoFocus?: boolean;
}

export function ChatComposer(props: ChatComposerProps): React.JSX.Element;
