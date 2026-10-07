import * as React from "react";

/** Multi-line text input. Shares the Input field styling. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

export function Textarea(props: TextareaProps): React.JSX.Element;
