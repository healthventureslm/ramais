import * as React from "react";

/** Familias da paleta usaveis para CATEGORIZACAO (nao para semantica). */
export type TagFamily = "petrol" | "emerald" | "amber" | "coral" | "crimson";
/** Peso visual, do mais forte ao mais fraco. */
export type TagTreatment = "filled" | "outline" | "neutral";

/** Removable chip — filters, selected templates, applied catalogue items. */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional leading icon node. */
  icon?: React.ReactNode;
  /** When provided, renders a remove (x) button calling this handler. */
  onRemove?: () => void;
  /**
   * Familia cromatica para CATEGORIZACAO. Sem ela o chip fica neutro.
   *
   * Nunca reuse o par semantico (`--danger-bg` e afins) para categoria: um
   * chip de "Medicacoes" em vermelho le como alerta. Categoria e semantica
   * sao eixos diferentes.
   */
  family?: TagFamily;
  /**
   * Peso visual. So tem efeito com `family`. `filled` pesa mais que `outline`,
   * que pesa mais que `neutral` — entao a ordem das categorias comunica
   * relevancia. @default "filled"
   */
  treatment?: TagTreatment;
  /**
   * Torna o chip ALTERNAVEL — vira `<button>` com `aria-pressed`, que e o que
   * faz o leitor de tela anunciar ligado/desligado. Trocar so a cor nao
   * comunica estado, e um `<span>` colorido nem alcancavel por teclado e.
   *
   * Para grade de multipla escolha visivel de uma vez, envolva em `ChipGroup`:
   * `SegmentedControl` e escolha unica e `MultiSelect` e campo com dropdown.
   */
  pressed?: boolean;
  onToggle?: (proximo: boolean) => void;
  /** So tem efeito no modo alternavel. @default false */
  disabled?: boolean;
  children?: React.ReactNode;
}

export interface ChipGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Vira o `aria-label` do grupo — diga o que esta sendo escolhido. */
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ChipGroup(props: ChipGroupProps): React.JSX.Element;

export function Tag(props: TagProps): React.JSX.Element;

/**
 * Par familia/tratamento estavel a partir de um indice — 15 combinacoes
 * distinguiveis sem inventar matiz novo.
 *
 * ```jsx
 * {categorias.map((c, i) => <Tag key={c} {...categoryStyle(i)}>{c}</Tag>)}
 * ```
 *
 * Percorre os cinco `filled`, depois os cinco `outline`, depois os `neutral`.
 * Como o peso decresce nessa ordem, ordenar as categorias por relevancia
 * clinica ja produz a hierarquia. Acima de 15 repete — mais de 15 categorias
 * visualmente distintas na mesma tela e problema da tela, nao da paleta.
 */
export function categoryStyle(index: number): { family: TagFamily; treatment: TagTreatment };
