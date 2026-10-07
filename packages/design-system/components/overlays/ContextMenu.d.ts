import * as React from "react";

/**
 * Pressione e segure para agir sobre um item — o gesto do Telegram e do iOS.
 *
 * Resolve um problema que o mobile tem e o desktop nao: sem hover e sem botao
 * direito, um item de lista nao tem onde guardar acoes secundarias. Ou elas
 * ficam permanentemente visiveis (ruido em cada linha) ou nao existem.
 *
 * @startingPoint section="Overlays" subtitle="Pressionar e segurar" viewport="390x420"
 */
export interface ContextMenuItem {
  id?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Destrutivo em vermelho. Coloque por ultimo. */
  danger?: boolean;
  disabled?: boolean;
  onSelect?: (id?: string) => void;
}

export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: ContextMenuItem[];
  /**
   * Tempo de pressao em ms. Abaixo de ~350ms o gesto dispara em toques
   * normais; acima de ~600ms a pessoa desiste antes. @default 450
   */
  delay?: number;
  disabled?: boolean;
  /**
   * Ergue uma copia do item sobre o fundo borrado. Manter o item visivel
   * responde "agir sobre o que?" sem a pessoa precisar lembrar em qual linha
   * estava. Desligue so quando o conteudo for pesado de renderizar duas vezes.
   * @default true
   */
  showPreview?: boolean;
  container?: HTMLElement | React.RefObject<HTMLElement> | null;
  onOpenChange?: (aberto: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}

export function ContextMenu(props: ContextMenuProps): React.JSX.Element;
