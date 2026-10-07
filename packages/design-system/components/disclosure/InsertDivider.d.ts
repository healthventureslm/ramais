import * as React from "react";

/**
 * Régua entre dois itens que revela um "+" para inserir no meio de uma lista
 * ordenada — builder de template, de roteiro, de schema.
 *
 * @startingPoint section="Disclosure" subtitle="Inserir no meio da lista" viewport="480x220"
 */
export interface InsertDividerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /**
   * `subtle` vive ENTRE itens e não pode competir com o conteúdo — a régua só
   * aparece no hover. `prominent` vive no FIM da lista e precisa ser um alvo
   * óbvio: área tracejada com rótulo.
   *
   * Em toque (`hover: none`) o `subtle` fica sempre visível em tom fraco: um
   * alvo que só existe no hover é inalcançável no celular.
   * @default "subtle"
   */
  variant?: "subtle" | "prominent";
  /** Texto do `prominent` e aria-label do `subtle`. @default "Inserir item aqui" */
  label?: string;
  onInsert?: () => void;
  disabled?: boolean;
  className?: string;
}

export function InsertDivider(props: InsertDividerProps): React.JSX.Element;
