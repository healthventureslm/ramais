import * as React from "react";

/** A file shown in the list. Pass `defaultFiles` to render pre-existing/demo states. */
export interface UploadFile {
  /** Display name. */
  name: string;
  /** Size in bytes — rendered in mono via the size formatter. */
  size?: number;
  /** Lifecycle state. @default "ready" */
  status?: "ready" | "uploading" | "done" | "error";
  /** Progress 0–100, shown as a bar while `status === "uploading"`. */
  progress?: number;
  /** Error message shown in place of the size/status line. */
  error?: string;
  /** Image URL to show as a thumbnail (for pre-existing images, e.g. an uploaded logo). */
  url?: string;
}

/**
 * Drag-and-drop file dropzone with click-to-browse, a reviewable file list,
 * per-file size, progress, done and error states. Built for clinical attachments
 * (laudos, exames, PDFs). PT-BR copy and sentence case throughout.
 *
 * @startingPoint section="Forms" subtitle="Dropzone with drag-and-drop & file list" viewport="560x420"
 */
export interface FileUploadProps {
  /** id do input; gerado automaticamente quando ausente. */
  id?: string;
  className?: string;

  /** Field label rendered above the dropzone. */
  label?: React.ReactNode;
  /** Helper text shown below when there is no error. */
  hint?: React.ReactNode;
  /** Error message — turns the dropzone into its invalid state. */
  error?: React.ReactNode;
  /** Show a coral asterisk next to the label. @default false */
  required?: boolean;
  /** `accept` attribute, e.g. ".pdf,.jpg". Also rendered as a format hint. */
  accept?: string;
  /** Allow selecting/dropping more than one file. @default false */
  multiple?: boolean;
  /** Disable the control. @default false */
  disabled?: boolean;
  /** Max bytes per file — larger files are added in the error state. */
  maxSize?: number;
  /** Compact single-row layout instead of the tall dropzone. @default false */
  compact?: boolean;
  /** Show image thumbnails for image files in the list (object URLs auto-revoked). @default true */
  preview?: boolean;
  /** Override the main prompt line entirely. */
  prompt?: React.ReactNode;
  /** Emphasised verb in the default prompt. @default "selecione" */
  accentLabel?: React.ReactNode;
  /** Files to render on mount (demo/pre-filled states). */
  defaultFiles?: UploadFile[];
  /** Called with the full file array whenever it changes (add/remove). */
  onFilesChange?: (files: UploadFile[]) => void;
  /** Called with the native File[] the moment files are chosen or dropped. */
  onSelect?: (files: File[]) => void;
}

export function FileUpload(props: FileUploadProps): React.JSX.Element;
