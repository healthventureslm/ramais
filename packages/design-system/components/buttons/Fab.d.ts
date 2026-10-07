import * as React from "react";

/**
 * Acao primaria flutuante. No mobile a acao mais importante nao cabe num
 * cabecalho — la em cima ela fica fora do alcance do polegar.
 *
 * UMA por tela. Duas acoes flutuantes competindo significa que nenhuma das
 * duas e a principal, e o lugar delas passa a ser o conteudo.
 *
 * @startingPoint section="Buttons" subtitle="Acao flutuante" viewport="390x200"
 */
export interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatorio na pratica: sem rotulo visivel, e a UNICA forma de saber o que o botao faz. */
  label?: string;
  icon?: React.ReactNode;
  /**
   * Mostra o rotulo ao lado do icone. Use quando a acao NAO e obvia pelo
   * icone — icone sozinho so funciona quando ninguem precisa adivinhar.
   * @default false
   */
  extended?: boolean;
  /** @default "primary" */
  variant?: "primary" | "secondary" | "live";
  /** @default "end" */
  corner?: "start" | "end" | "center";
  /** @default "fixed" — use `absolute` dentro de uma moldura de preview. */
  position?: "fixed" | "absolute" | "static";
  /** Some ao rolar para baixo, junto com a TabBar. @default false */
  hideOnScroll?: boolean;
  scrollRef?: React.RefObject<HTMLElement> | null;
  className?: string;
}

export const Fab: React.ForwardRefExoticComponent<
  FabProps & React.RefAttributes<HTMLButtonElement>
>;
