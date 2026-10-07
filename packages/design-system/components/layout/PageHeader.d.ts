import * as React from "react";

/**
 * Degrau de título de página, em três escalas.
 *
 * A escala `mobile` delega para `NavBar` de proposito: NavBar E a forma mobile
 * deste componente, nao um cabecalho paralelo. Duas APIs para o mesmo conceito
 * divergem em semanas e o produto passa a escolher por acidente.
 *
 * @startingPoint section="Layout" subtitle="Cabeçalho de página" viewport="900x180"
 */
export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * `greeting` = dashboard (título maior, respiro maior);
   * `page` = telas internas; `mobile` = renderiza `NavBar`.
   * @default "page"
   */
  variant?: "greeting" | "page" | "mobile";
  /** Sobrelinha em caixa alta tracked-out — data, contexto. Ignorada em `mobile`. */
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ícone em chip tingido de marca. Ignorado em `mobile`. */
  icon?: React.ReactNode;
  /** Nó de ações à direita (tipicamente `<Button>`). Em `mobile`, use `NavBar`. */
  actions?: React.ReactNode;
  /** Mostra o botão voltar. @default false */
  back?: boolean;
  /** Rótulo do voltar. Em `mobile` vira o texto ao lado do chevron. */
  backLabel?: string;
  /**
   * Destino do voltar. Presente, o controle vira `<a href>` de verdade em vez
   * de um botao que navega — abrir em nova aba e menu de contexto voltam a
   * funcionar. Implica `back`, entao nao precisa passar os dois.
   */
  backTo?: string;
  onBack?: () => void;
  /** Só em `mobile`: ref do elemento que rola, que dirige o colapso do título. */
  scrollRef?: React.RefObject<HTMLElement> | null;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader(props: PageHeaderProps): React.JSX.Element;
