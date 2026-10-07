import * as React from "react";

/**
 * Ponto ou contador sobreposto ao canto de um controle.
 *
 * Não confundir com `Badge`: `Badge` é uma pílula NO FLUXO, ao lado do texto,
 * e carrega rótulo. `Indicator` é marca de notificação, posicionada
 * absolutamente sobre o canto de um ícone, e carrega no máximo um número.
 * O elemento que o contém precisa ter `position: relative`.
 *
 * @startingPoint section="Data display" subtitle="Marca de notificação" viewport="200x80"
 */
export interface IndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * `true` renderiza um ponto; número ou string renderiza um contador;
   * `false`/`null`/`undefined` não renderizam nada — então dá para passar o
   * valor cru sem condicional em volta. Qualquer falsy — `false`, `null`,
   * `0`, `""` — nao renderiza nada. Nao tem default: ausente nao
   * renderiza. Para um ponto sem numero, passe `value` (ou `value={true}`).
   */
  value?: boolean | number | string | null;
  /**
   * Tom. O padrao e o acento da marca. `live` e so para processo com relogio
   * correndo (gravacao em andamento) — contagem de nao lidos nao e isso.
   * `on-brand` e para quando o fundo e a superficie de marca.
   * @default "brand"
   */
  tone?: "brand" | "on-brand" | "live" | "danger" | "positive" | "neutral";
  /**
   * Qualifica o CONTADOR para leitor de tela — "3 mensagens nao lidas".
   * O ponto sem numero continua `aria-hidden`: sozinho ele nao diz nada, e
   * quem carrega o significado e o rotulo do controle em volta. Ja o numero
   * E a informacao, e antes ficava fora da arvore de acessibilidade.
   */
  label?: string;
  /** Canto onde a marca encosta. @default "top-right" */
  position?: "top-right" | "top-left" | "inset";
  /** Acima disso vira `{max}+`. @default 99 */
  max?: number;
  /**
   * Cor do anel que recorta o indicador da superfície de baixo. Informe quando
   * o fundo não for `--surface-card` — vidro, chrome de marca, canvas.
   * @default "var(--surface-card)"
   */
  ring?: string;
  className?: string;
}

export function Indicator(props: IndicatorProps): React.JSX.Element | null;
