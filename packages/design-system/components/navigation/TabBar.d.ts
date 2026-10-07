import * as React from "react";

/**
 * Navegação principal inferior do mobile, na zona do polegar (One UI 9),
 * em vidro tingido de marca (Liquid Glass). Suporta o estado LIVE com o pulso
 * coral — a assinatura da marca — para gravação em andamento.
 *
 * @startingPoint section="Navigation" subtitle="Tab bar inferior mobile" viewport="390x90"
 */
export interface TabBarProps {
  /** De 2 a 5 itens. Acima disso, o quinto vira "Mais" e abre um Sheet. */
  items: TabBarItem[];
  /** Id do item ativo. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /**
   * Superfície. `glass` (padrão) é o vidro claro; `brand` é o vidro petrol;
   * `solid` é opaca. @default "glass"
   */
  variant?: "glass" | "brand" | "solid";
  /**
   * `attached` (padrão) cola na borda inferior; `floating` vira uma cápsula
   * suspensa com margem lateral — o gesto Liquid Glass.
   * @default "attached"
   */
  shape?: "attached" | "floating";
  /**
   * Quando mostrar os rótulos. `active` economiza altura mantendo a orientação;
   * `never` só faz sentido com ícones inequívocos. @default "always"
   */
  labels?: "always" | "active" | "never";
  /** @default "fixed" — use `absolute` dentro de uma moldura de preview. */
  position?: "fixed" | "absolute" | "static";
  /**
   * Esconde ao rolar para baixo e revela ao rolar para cima, entregando a tela
   * inteira ao conteúdo. Tem limiar de 8px para não piscar com o bounce do iOS.
   * @default false
   */
  hideOnScroll?: boolean;
  /** Ref do elemento que rola. Sem ele, observa o scroll da janela. */
  scrollRef?: React.RefObject<HTMLElement> | null;
  /** @default "Navegação principal" */
  ariaLabel?: string;
  className?: string;
}

export function TabBar(props: TabBarProps): React.JSX.Element;

export interface TabBarItem {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  /** Variante do ícone quando ativo (ex.: preenchido em vez de contornado). */
  activeIcon?: React.ReactNode;
  /** `true` renderiza um ponto coral; número/string renderiza um contador. */
  badge?: boolean | number | string;
  /**
   * Marca o item como LIVE: pílula coral com o pulso da marca. Use para
   * gravação em andamento — o item continua pulsando fora da tela de captura.
   */
  live?: boolean;
  disabled?: boolean;
  onClick?: (id: string) => void;
}
