import * as React from "react";

/**
 * Navegação principal em barra — a alternativa à SidebarNav para produtos com
 * poucos destinos. A coluna lateral cobra ~264px de largura permanente; com
 * até ~6 destinos de primeiro nível, o conteúdo (tabela, laudo, prontuário)
 * aproveita melhor essa largura. Mesma API da SidebarNav onde faz sentido.
 *
 * Responde à própria largura (container query): sai o nome do usuário, depois
 * os rótulos dos itens (ficam os ícones), depois o nome da marca.
 *
 * @startingPoint section="Navigation" subtitle="Barra superior do app" viewport="900x700"
 */
export interface TopNavProps extends React.HTMLAttributes<HTMLElement> {
  brand?: TopNavBrand;
  /** Nó que substitui o lockup inteiro (marca + nome). */
  brandSlot?: React.ReactNode;
  /** Destino da marca (ex.: início). Sem ele, a marca é só rótulo. */
  brandHref?: string;
  items?: TopNavItem[];
  /** Id do item atual. */
  activeId?: string;
  onSelect?: (id: string) => void;
  user?: TopNavUser;
  /** Itens do menu que abre no bloco do usuário (mesmo formato do `Menu`). */
  userMenu?: import("../overlays/Menu").MenuItem[];
  /** Sem `userMenu`, o bloco do usuário vira botão direto. */
  onUserClick?: () => void;
  /** `brand` = faixa petrol (padrão); `light` = superfície de cartão. @default "brand" */
  surface?: "brand" | "light";
  /** `bar` = faixa de ponta a ponta; `floating` = peça pousada com folga em volta. @default "bar" */
  variant?: "bar" | "floating";
  /** @default true */
  sticky?: boolean;
  /** @default "Navegação principal" */
  ariaLabel?: string;
  /** @default "Sua conta" */
  userMenuLabel?: string;
  className?: string;
}

export interface TopNavBrand {
  title: string;
  /** URL do monograma. */
  markSrc?: string | null;
}

export interface TopNavItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Com `href` o item vira link; `onSelect` continua sendo chamado. */
  href?: string;
  /** Ponto de novidade. */
  badge?: boolean;
}

export interface TopNavUser {
  name: string;
  role?: string;
  avatarSrc?: string;
}

export function TopNav(props: TopNavProps): React.JSX.Element;
