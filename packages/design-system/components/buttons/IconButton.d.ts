import * as React from "react";

/** Square icon-only button. Always pass `label` for accessibility. */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Visual style. `danger` = acao destrutiva (excluir, remover). @default "quiet" */
  variant?: "quiet" | "solid" | "outline" | "ghost" | "danger";
  /** Size. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Accessible label (also shown as native tooltip). Required. */
  label: string;
  /**
   * Sobre superficie de marca (sidebar petrol, NavBar variant="brand"), onde
   * os tokens de texto normais ficariam ilegiveis. Combina com qualquer
   * variante. Mesmo padrao do `onBrand` do Spinner. @default false
   */
  onBrand?: boolean;
  /**
   * Renderiza como `<a>` em vez de `<button>`. Navegar e acionar sao coisas
   * diferentes para teclado e leitor de tela — e um `<button>` que navega
   * quebra abrir-em-nova-aba, arrastar o link e o menu de contexto.
   */
  href?: string;
  /** The icon node (e.g. a Lucide <svg>). */
  children: React.ReactNode;
}

export const IconButton: React.ForwardRefExoticComponent<
  IconButtonProps & React.RefAttributes<HTMLButtonElement | HTMLAnchorElement>
>;
