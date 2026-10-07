import * as React from "react";

/**
 * Primary call-to-action and secondary action button for Health Ventures products.
 *
 * @startingPoint section="Buttons" subtitle="Primary, secondary, ghost & danger actions" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. `primary` = petrol fill (main action). @default "primary" */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  /** Control height. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Stretch to fill the container width. @default false */
  block?: boolean;
  /**
   * Acao aceita e em andamento. Mostra o spinner e barra novos cliques, mas
   * NAO usa o atributo `disabled`: o botao continua focavel e anunciado
   * (`aria-busy`), senao quem apertou Enter perde o lugar no teclado
   * exatamente enquanto espera.
   *
   * O spinner entra EMPILHADO sobre o conteudo, que some por opacidade e
   * segura a largura de repouso — o botao nao muda de tamanho no meio do
   * clique. Como o rotulo fica invisivel enquanto carrega, passe sempre o
   * MESMO texto (`"Salvar"`, nao `"Salvando…"`): trocar a copia mudaria a
   * largura de novo e ninguem leria a troca. Quem anuncia o estado e o
   * `aria-busy`. @default false
   */
  loading?: boolean;
  /** Lucide (or any) icon node rendered before the label. */
  iconLeft?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconRight?: React.ReactNode;
  /**
   * Renderiza como `<a>` em vez de `<button>`. Navegar e acionar sao coisas
   * diferentes para teclado e leitor de tela — e um `<button>` que navega
   * quebra abrir-em-nova-aba, arrastar o link e o menu de contexto.
   */
  href?: string;
  /**
   * Sobre superficie de marca (SidebarNav, NavBar `variant="brand"`), onde os
   * tokens de texto normais ficariam ilegiveis. Pensado para combinar com
   * `quiet`/`ghost`: preenchimento petrol sobre chrome petrol nao se
   * distingue do fundo. Mesmo padrao do IconButton e do Spinner.
   * @default false
   */
  onBrand?: boolean;
  children?: React.ReactNode;
}

export const Button: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement | HTMLAnchorElement>
>;
