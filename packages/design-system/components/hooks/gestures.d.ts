import * as React from "react";

/** Vibracao curta onde o navegador expoe (Android/Chrome; iOS nao expoe). */
export function haptics(padrao?: number | number[]): boolean;

export interface SwipeDismissOptions {
  onDismiss?: () => void;
  /**
   * Gesto no sentido CONTRARIO. Quando presente, o painel segue o dedo nos dois
   * sentidos em vez de encontrar resistencia — resistir num gesto que TEM
   * destino e o que faz a interface parecer travada. O Sheet usa isto para
   * subir um detent.
   */
  onReverse?: () => void;
  /** @default "y" */
  axis?: "x" | "y";
  /** 1 = para baixo/direita, -1 = para cima/esquerda. @default 1 */
  direction?: 1 | -1;
  /** Distancia minima em px. @default 96 */
  threshold?: number;
  /** Velocidade minima em px/ms — um flick curto tambem dispensa. @default 0.5 */
  velocity?: number;
  /** @default true */
  enabled?: boolean;
  /** Veto por evento: use para nao roubar o gesto de um filho que rola. */
  canStart?: (e: React.PointerEvent) => boolean;
}

export interface SwipeDismissResult {
  handlers: React.DOMAttributes<HTMLElement>;
  /** Deslocamento atual em px. */
  offset: number;
  /**
   * `true` enquanto o dedo esta na tela. DESLIGUE a transition enquanto for
   * true: interpolar durante o arraste aparece como atraso entre o dedo e o
   * elemento, e e isso que faz a interface parecer molenga.
   */
  dragging: boolean;
  reset: () => void;
}

/**
 * Arraste para dispensar. Dispensa por DISTANCIA ou por VELOCIDADE: so
 * distancia obriga um arraste longo, so velocidade dispensa sem querer num
 * toque nervoso.
 */
export function useSwipeDismiss(options?: SwipeDismissOptions): SwipeDismissResult;

/**
 * Trava o scroll do body enquanto um overlay esta aberto, preservando a
 * posicao. Conta as chamadas: dois overlays abertos ao mesmo tempo nao podem
 * destravar o body quando so o de cima fecha.
 */
export function useScrollLock(ativo: boolean): void;

/**
 * Prende o foco dentro de um overlay enquanto `ativo`, leva o foco para
 * dentro ao abrir e o DEVOLVE a quem o tinha ao fechar.
 *
 * Sheet, Dialog e Drawer declaravam `role="dialog"` e `aria-modal="true"` sem
 * nada disso: `aria-modal` promete que o resto da pagina esta inerte, e o Tab
 * saia do modal; ao fechar, o foco caia no `<body>` e quem navega por teclado
 * recomecava do topo da pagina.
 *
 * Exposto porque produto que monta o proprio overlay precisa do mesmo
 * comportamento — e porque copiar trap de foco e como as tres copias
 * divergem.
 */
export function useFocusTrap(
  ativo: boolean,
  painelRef: React.RefObject<HTMLElement | null>
): void;
