import * as React from "react";

/**
 * Lista de acoes que sobe de baixo — o que um `Menu` de desktop vira no
 * celular. Compoe sobre `Sheet`, herdando portal, scroll lock, safe area,
 * Esc e arraste.
 *
 * @startingPoint section="Overlays" subtitle="Acoes em sheet" viewport="390x520"
 */
export interface ActionSheetItem {
  id?: string;
  label: React.ReactNode;
  /** Segunda linha explicando a consequencia. */
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /**
   * Marca a acao como destrutiva. Coloque-a SEMPRE por ultimo: no polegar, o
   * item mais alto da lista e o mais facil de acertar sem olhar.
   */
  danger?: boolean;
  disabled?: boolean;
  onSelect?: (id?: string) => void;
}

export interface ActionSheetProps {
  open?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  items?: ActionSheetItem[];
  /** @default "Cancelar" */
  cancelLabel?: string;
  /**
   * O botao Cancelar separado. Mantenha ligado no mobile: e o que permite
   * dispensar sem mirar. @default true
   */
  showCancel?: boolean;
  /** Destino do portal — ver `Sheet`. */
  container?: HTMLElement | React.RefObject<HTMLElement> | null;
  className?: string;
}

export function ActionSheet(props: ActionSheetProps): React.JSX.Element;
