import * as React from "react";

/**
 * Barra de navegação superior do mobile. Título grande que colapsa
 * continuamente no scroll (One UI 9) sobre material de vidro tingido de marca
 * (Liquid Glass), com o conteúdo passando por baixo em vez de ser cortado por
 * um divisor.
 *
 * @startingPoint section="Navigation" subtitle="Barra superior mobile" viewport="390x160"
 */
export interface NavBarProps {
  /** Título da tela. Vira o título grande e, ao colapsar, o título compacto. */
  title?: React.ReactNode;
  /** Linha de apoio — leito, unidade, contagem. */
  subtitle?: React.ReactNode;
  /**
   * Renderiza o título grande que colapsa. Desligue em telas de detalhe
   * profundas, onde só a barra compacta faz sentido. @default true
   */
  largeTitle?: boolean;
  /** Botão voltar. Com `label`, vira chevron + texto (estilo iOS). */
  back?: NavBarBack | null;
  /** Ações à direita (no máximo duas — o resto vai para um ActionSheet). */
  actions?: NavBarAction[];
  /**
   * Superfície. `glass` (padrão) é o vidro flutuante; `solid` é opaca, para
   * telas de conteúdo denso; `brand` é o petrol escuro.
   * @default "glass"
   */
  variant?: "glass" | "solid" | "brand";
  /**
   * `sticky` (padrão) gruda no topo do container que rola — é o que faz o
   * conteúdo deslizar por baixo do vidro. Use `fixed` num shell de app e
   * `static` quando a barra não deve acompanhar o scroll.
   * @default "sticky"
   */
  position?: "sticky" | "fixed" | "static";
  /** Alinhamento do título compacto quando `largeTitle` é false. @default "start" */
  align?: "start" | "center";
  /**
   * Ref do elemento que rola. Sem ele, a barra observa o scroll da janela.
   * É o que dirige o colapso do título e a hairline do scroll edge.
   */
  scrollRef?: React.RefObject<HTMLElement> | null;
  /** Progresso 0–1 — filete na base da barra (upload, transcrição). */
  progress?: number | null;
  /** Conteúdo extra abaixo do título (Tabs, SegmentedControl, busca). */
  children?: React.ReactNode;
  className?: string;
}

export function NavBar(props: NavBarProps): React.JSX.Element;

export interface NavBarBack {
  /** Texto ao lado do chevron. Sem ele, vira só o ícone (44px). */
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface NavBarAction {
  id?: string;
  icon: React.ReactNode;
  /** Obrigatório na prática: vira o aria-label do botão só de ícone. */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** `true` renderiza um ponto coral; número/string renderiza um contador. */
  badge?: boolean | number | string;
}
