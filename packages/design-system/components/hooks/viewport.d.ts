import * as React from "react";

export type HVPlatform = "mobile" | "tablet" | "desktop";

export interface HVViewport {
  platform: HVPlatform;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Ponteiro grosso (dedo). Nao e o mesmo que mobile: ha tablet com mouse. */
  coarse: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
}

/**
 * Estado da plataforma. FUNCIONA SEM PROVIDER — assina o proprio matchMedia
 * quando nao ha `HVProvider` em volta, porque componentes do DS chamam este
 * hook internamente e nao podem obrigar o app a mexer na raiz.
 */
export function useViewport(): HVViewport;

/** So a string da plataforma. */
export function usePlatform(): HVPlatform;

export interface HVProviderProps {
  /**
   * `auto` segue a janela. Forcar serve a preview e ao portal — e mantem os
   * sinais de acessibilidade reais (reduzir movimento continua valendo).
   * Tambem escreve `data-hv-platform` no `<html>`, para o CSS acompanhar sem
   * ninguem re-renderizar. @default "auto"
   */
  platform?: HVPlatform | "auto";
  children?: React.ReactNode;
}

export function HVProvider(props: HVProviderProps): React.JSX.Element;

export interface SafeArea { top: number; right: number; bottom: number; left: number; }

/**
 * Valores RESOLVIDOS de env(safe-area-inset-*), em pixels.
 *
 * Use so quando precisar do NUMERO para calculo em JS. Para layout prefira os
 * tokens `--safe-*` no CSS: nao custam medicao. Ler o token via
 * getComputedStyle nao funciona — ele devolve a string `env(...)`, nao o valor.
 */
export function useSafeArea(): SafeArea;

/**
 * Altura coberta pelo teclado virtual, em pixels. `window.innerHeight` nao muda
 * quando o teclado abre no iOS; quem sabe disso e o `visualViewport`. Devolve 0
 * onde nao ha suporte, que e o mesmo que "nao sei".
 */
export function useKeyboardInset(): number;

/**
 * Resolve o destino de um portal a partir de elemento, ref ou nada.
 *
 * A expressao ingenua tem um buraco que so aparece as vezes: no PRIMEIRO
 * render `ref.current` ainda e null, entao `container.current ? ... : container`
 * cai no OBJETO DE REF, que e truthy — e o React estoura com "Target container
 * is not a DOM element". Nao aparece quando o overlay comeca fechado; so
 * quando ele abre de primeira.
 */
export function resolvePortalTarget(
  container?: HTMLElement | React.RefObject<HTMLElement> | null
): Element | null;
