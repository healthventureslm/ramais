import React from "react";
const BP_MOBILE = "(max-width: 767px)";
const BP_TABLET = "(min-width: 768px) and (max-width: 1023px)";
const PONTEIRO_GROSSO = "(pointer: coarse)";
const MENOS_MOVIMENTO = "(prefers-reduced-motion: reduce)";
const MENOS_TRANSPARENCIA = "(prefers-reduced-transparency: reduce)";
const temMM = () => typeof window !== "undefined" && typeof window.matchMedia === "function";
const casa = (q) => temMM() ? window.matchMedia(q).matches : false;
let _cache = null;
let _chave = "";
function lerViewport() {
  const mobile = casa(BP_MOBILE);
  const tablet = casa(BP_TABLET);
  const coarse = casa(PONTEIRO_GROSSO);
  const reducedMotion = casa(MENOS_MOVIMENTO);
  const reducedTransparency = casa(MENOS_TRANSPARENCIA);
  const platform = mobile ? "mobile" : tablet ? "tablet" : "desktop";
  const chave = [platform, coarse, reducedMotion, reducedTransparency].join("|");
  if (chave !== _chave) {
    _chave = chave;
    _cache = {
      platform,
      isMobile: platform === "mobile",
      isTablet: platform === "tablet",
      isDesktop: platform === "desktop",
      coarse,
      reducedMotion,
      reducedTransparency
    };
  }
  return _cache;
}
const SNAPSHOT_SERVIDOR = {
  platform: "desktop",
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  coarse: false,
  reducedMotion: false,
  reducedTransparency: false
};
function assinar(aoMudar) {
  if (!temMM()) return () => {
  };
  const listas = [BP_MOBILE, BP_TABLET, PONTEIRO_GROSSO, MENOS_MOVIMENTO, MENOS_TRANSPARENCIA].map((q) => window.matchMedia(q));
  for (const mql of listas) {
    if (mql.addEventListener) mql.addEventListener("change", aoMudar);
    else mql.addListener(aoMudar);
  }
  return () => {
    for (const mql of listas) {
      if (mql.removeEventListener) mql.removeEventListener("change", aoMudar);
      else mql.removeListener(aoMudar);
    }
  };
}
const ViewportCtx = React.createContext(null);
function useViewport() {
  const forcado = React.useContext(ViewportCtx);
  const daJanela = React.useSyncExternalStore(assinar, lerViewport, () => SNAPSHOT_SERVIDOR);
  return forcado || daJanela;
}
function usePlatform() {
  return useViewport().platform;
}
function HVProvider({ platform = "auto", children }) {
  const daJanela = React.useSyncExternalStore(assinar, lerViewport, () => SNAPSHOT_SERVIDOR);
  const valor = React.useMemo(() => {
    if (platform === "auto") return daJanela;
    return {
      ...daJanela,
      platform,
      isMobile: platform === "mobile",
      isTablet: platform === "tablet",
      isDesktop: platform === "desktop"
    };
  }, [platform, daJanela]);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const raiz = document.documentElement;
    const anterior = raiz.getAttribute("data-hv-platform");
    raiz.setAttribute("data-hv-platform", valor.platform);
    return () => {
      if (anterior) raiz.setAttribute("data-hv-platform", anterior);
      else raiz.removeAttribute("data-hv-platform");
    };
  }, [valor.platform]);
  return /* @__PURE__ */ React.createElement(ViewportCtx.Provider, { value: valor }, children);
}
const SAFE_ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
function useSafeArea() {
  const [safe, setSafe] = React.useState(SAFE_ZERO);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const sonda = document.createElement("div");
    sonda.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "visibility:hidden",
      "pointer-events:none",
      "padding-top:env(safe-area-inset-top,0px)",
      "padding-right:env(safe-area-inset-right,0px)",
      "padding-bottom:env(safe-area-inset-bottom,0px)",
      "padding-left:env(safe-area-inset-left,0px)"
    ].join(";");
    document.body.appendChild(sonda);
    const medir = () => {
      const cs = getComputedStyle(sonda);
      const proximo = {
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0
      };
      setSafe((atual) => atual.top === proximo.top && atual.right === proximo.right && atual.bottom === proximo.bottom && atual.left === proximo.left ? atual : proximo);
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
      sonda.remove();
    };
  }, []);
  return safe;
}
function useKeyboardInset() {
  const [inset, setInset] = React.useState(0);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const medir = () => {
      const coberto = window.innerHeight - (vv.height + vv.offsetTop);
      const proximo = coberto > 24 ? Math.round(coberto) : 0;
      setInset((atual) => atual === proximo ? atual : proximo);
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);
  return inset;
}
function resolvePortalTarget(container) {
  if (typeof document === "undefined") return null;
  const alvo = container && typeof container === "object" && "current" in container ? container.current : container;
  return alvo instanceof Element ? alvo : document.body;
}
export {
  HVProvider,
  resolvePortalTarget,
  useKeyboardInset,
  usePlatform,
  useSafeArea,
  useViewport
};
