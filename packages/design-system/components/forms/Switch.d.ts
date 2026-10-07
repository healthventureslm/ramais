import * as React from "react";

/** On/off toggle switch. Use for instant settings (no Save needed). */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export function Switch(props: SwitchProps): React.JSX.Element;
