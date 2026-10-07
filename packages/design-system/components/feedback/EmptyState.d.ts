import * as React from "react";

/**
 * Centered empty / zero-data state: optional icon, title, description and actions.
 * Use for empty lists, no search results, first-run prompts and error fallbacks.
 * Sentence-case PT-BR copy.
 *
 * @startingPoint section="Feedback" subtitle="Zero-data state with icon, copy & actions" viewport="520x360"
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon node (Lucide `<i data-lucide>` or SVG) shown in a circular chip. */
  icon?: React.ReactNode;
  /** Headline — short, sentence case. */
  title?: React.ReactNode;
  /** Supporting sentence explaining the state or next step. */
  description?: React.ReactNode;
  /** Primary action, typically a `<Button>`. */
  action?: React.ReactNode;
  /** Secondary action, typically a ghost/quiet `<Button>`. */
  secondaryAction?: React.ReactNode;
  /** Density. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Surround chrome. `card` = solid border, `dashed` = dropzone-style outline. @default "plain" */
  variant?: "plain" | "card" | "dashed";
  /**
   * Alinhamento do conteudo. `start` e o padrao: o vazio e informacao
   * operacional e se le como as outras linhas da tela. Use `center` so na
   * caixa pequena e quadrada — card estreito, celula de tabela — onde a
   * margem esquerda nao tem de onde comecar.
   * @default "start"
   */
  align?: "start" | "center";
  /**
   * Estado de carregamento — o outro estado da MESMA caixa: a lista esta
   * vazia ou ainda nao chegou. Troca o icone pelo Spinner e o titulo pelo
   * rotulo de carregamento. A estrutura e identica, entao com os mesmos props
   * a altura nao muda quando o dado chega (medido: 0px). Acoes somem — nao ha
   * o que acionar sobre dado ausente — e por isso um estado vazio COM acao
   * ainda salta (~60px); isso e escolha estrutural de quem usa.
   */
  loading?: boolean;
  /** @default "Carregando…" */
  loadingLabel?: React.ReactNode;
  /** Extra content rendered between copy and actions. */
  children?: React.ReactNode;
}

export function EmptyState(props: EmptyStateProps): React.JSX.Element;
