import * as React from "react";

/**
 * Linha de lista — o padrão dominante das telas do produto, mais comum que
 * `Table`. `ListGroup` é a moldura agrupada (One UI): várias linhas num cartão
 * de raio generoso, divididas por hairline.
 *
 * @startingPoint section="Data display" subtitle="Lista agrupada" viewport="520x360"
 */
export interface ListItemProps extends React.HTMLAttributes<HTMLElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /**
   * Subtítulo em partes — "setor · horário", "leito · prontuário". O
   * espaçamento e o separador ficam no DS em vez de cada tela desenhar os
   * seus. Equivale a passar várias crianças em `subtitle`: um fragmento com
   * dois filhos é detectado sozinho.
   */
  subtitleParts?: React.ReactNode[];
  /**
   * Separador entre as partes. `false` remove e deixa só o espaço.
   * @default "·"
   */
  separator?: React.ReactNode | false;
  /** `data` renderiza o subtítulo em mono — vitais, MRN, leito. @default "text" */
  subtitleAs?: "text" | "data";
  /** Nó à esquerda: `Avatar`, ícone, `StatusDot`. */
  media?: React.ReactNode;
  /** Texto curto à direita, em mono — hora, contagem. */
  meta?: React.ReactNode;
  /** Controles à direita. Presentes, suprimem a seta por padrão. */
  actions?: React.ReactNode;
  /**
   * Força a seta. Por padrão ela aparece só quando há `href` e não há
   * `actions` — mostrar seta numa linha que não navega promete o que não
   * existe.
   */
  chevron?: boolean;
  /**
   * Com `onClick` a linha vira `<button>`; com `href`, `<a>`; sem nenhum,
   * `<div>`. Não é cosmético: um `<div onClick>` não é alcançável por Tab
   * nem anunciado como acionável.
   */
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  disabled?: boolean;
  /** Marca a linha como a atual (`aria-current`). @default false */
  active?: boolean;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Permite quebra de linha em título e subtítulo. @default false */
  wrap?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ListItem(props: ListItemProps): React.JSX.Element;

export interface ListGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rótulo em caixa alta acima do grupo. */
  label?: React.ReactNode;
  /** Sem cartão nem borda — só o empilhamento. @default false */
  plain?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ListGroup(props: ListGroupProps): React.JSX.Element;
