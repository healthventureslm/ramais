import * as React from "react";

export interface MenuItem {
  /** Item kind. Omit for a normal action item. */
  type?: "item" | "separator" | "heading";
  /** Stable id (passed to onAction). */
  id?: string;
  label?: React.ReactNode;
  /** Leading icon node (e.g. a Lucide <i>). */
  icon?: React.ReactNode;
  /** Right-aligned shortcut/meta text. */
  shortcut?: React.ReactNode;
  /** Red destructive styling. */
  danger?: boolean;
  disabled?: boolean;
  /** Fired when this item is chosen. */
  onSelect?: () => void;
}

/**
 * Branded dropdown / context menu — opens a rounded popover from any trigger
 * (e.g. a ⋯ IconButton). Keyboard + click-outside aware.
 *
 * @startingPoint section="Overlays" subtitle="Row actions ⋯, context menus" viewport="700x320"
 */
export interface MenuProps {
  /**
   * No mobile o Menu VIRA `ActionSheet`. Um dropdown posicionado por
   * coordenada, com linhas de ~32px, e impossivel de acertar com o polegar —
   * e ainda pode abrir fora da tela perto da borda. @default true
   */
  responsive?: boolean;
  /** Titulo do sheet no mobile. Sem ele o sheet abre so com as acoes. */
  sheetTitle?: React.ReactNode;
  /** Destino do portal do sheet — ver `Sheet`. */
  container?: HTMLElement | React.RefObject<HTMLElement> | null;

  /** The clickable trigger element (button/icon). */
  trigger: React.ReactNode;
  items: MenuItem[];
  /** Horizontal anchor of the popover. @default "end" */
  align?: "start" | "end";
  /** Open upward or downward. @default "down" */
  side?: "down" | "up";
  /** Fires with the chosen item's id (or label). */
  onAction?: (id: React.ReactNode) => void;
  className?: string;
}

export function Menu(props: MenuProps): React.JSX.Element;
