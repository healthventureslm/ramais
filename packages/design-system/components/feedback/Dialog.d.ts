import * as React from "react";

/** Modal dialog with overlay, optional icon, body and footer slot. */
export interface DialogProps {
  /**
   * No mobile o Dialog VIRA `Sheet`: um modal centrado de 480px numa tela de
   * 360px cola nas bordas e deixa a acao no meio da tela, fora do alcance do
   * polegar. Desligue quando o dialogo precisa continuar modal em qualquer
   * tamanho. @default true
   */
  responsive?: boolean;
  /** @default "Fechar" */
  closeLabel?: string;
  /**
   * Destino do portal — mesmo contrato do `Sheet`. Por padrao `document.body`.
   * Aponte para um elemento quando precisar CONTER o dialogo dentro de uma
   * moldura; o destino precisa ser bloco contentor de descendentes `fixed`
   * (`transform`, `filter`, `contain: layout|paint` — `position: relative` nao
   * basta).
   */
  container?: HTMLElement | React.RefObject<HTMLElement> | null;

  /** Controls visibility. @default true */
  open?: boolean;
  /** Called on overlay click / close button. */
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Icon node shown in a tinted square. */
  icon?: React.ReactNode;
  /** Red icon treatment for destructive dialogs. @default false */
  danger?: boolean;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Footer slot — usually the action buttons. */
  footer?: React.ReactNode;
  /** Body content. */
  children?: React.ReactNode;
  className?: string;
}

export function Dialog(props: DialogProps): React.JSX.Element | null;
