import * as React from "react";

/**
 * Invólucro de página: largura máxima, padding responsivo e ritmo vertical.
 *
 * @startingPoint section="Layout" subtitle="Invólucro de página" viewport="900x400"
 */
export interface PageContainerProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Largura máxima. É prop e não token cravado de propósito: `--content-max`
   * são 1240px e produtos existentes usam 64rem/56rem — adotar o token de uma
   * vez alargaria todas as telas numa migração, o que é decisão de produto.
   * @default "regular"
   */
  width?: "wide" | "regular" | "narrow" | "reading" | "full";
  /** `tight` reduz o respiro vertical entre blocos. @default "regular" */
  density?: "regular" | "tight";
  /** Remove o padding lateral — para quando o pai já tem o próprio. @default false */
  flush?: boolean;
  /**
   * Reserva a altura da TabBar no rodapé em telas < 768px. Desligue quando o
   * produto navega por sidebar e não tem TabBar — senão toda página ganha a
   * altura dela de espaço morto.
   *
   * O `--safe-bottom` fica fora dessa conta: ele protege o indicador de home e
   * vale com ou sem barra. @default true
   */
  tabbar?: boolean;
  /** Elemento renderizado. @default "div" */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export function PageContainer(props: PageContainerProps): React.JSX.Element;
