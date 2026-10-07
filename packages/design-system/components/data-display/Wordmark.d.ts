import * as React from "react";

/**
 * Monograma + nome do produto + byline, nas orientações horizontal e empilhada.
 *
 * @startingPoint section="Brand" subtitle="Lockup de marca" viewport="360x120"
 */
export interface WordmarkProps extends React.HTMLAttributes<HTMLElement> {
  /** Primeira parte do nome, em display bold. */
  name?: React.ReactNode;
  /**
   * Segunda parte, em itálico petrol — "Vox**Flow**", "Voice**Health**".
   * É o tratamento canônico da marca, no lugar da serifada que o wordmark
   * antigo pedia e que o DS nunca teve.
   */
  accent?: React.ReactNode;
  /** @default "by Health Ventures" — passe `null` para omitir. */
  byline?: React.ReactNode;
  /** URL do monograma (`assets/logo-monogram.svg`). */
  markSrc?: string;
  /** @default "horizontal" */
  orientation?: "horizontal" | "stacked";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Sobre superfície petrol, onde os tokens de texto normais somem. @default false */
  onBrand?: boolean;
  /** Renderiza como `<a>`. */
  href?: string;
  className?: string;
}

export function Wordmark(props: WordmarkProps): React.JSX.Element;
