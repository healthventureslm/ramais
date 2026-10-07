import React from "react";
import { Indicator } from "../data-display/Indicator.js";
const CSS = `
.hv-tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 70;
  font-family: var(--font-sans);
  padding-bottom: var(--safe-bottom, 0);
  padding-left: var(--safe-left, 0); padding-right: var(--safe-right, 0);
  transition: transform var(--dur-morph) var(--ease-spring);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.hv-tabbar[data-position="absolute"] { position: absolute; }
.hv-tabbar[data-position="static"]   { position: relative; }

/* Esconde ao rolar para baixo (d\xE1 a tela inteira ao conte\xFAdo) e volta
   ao rolar para cima \u2014 comportamento de Telegram/One UI. */
.hv-tabbar[data-hidden="true"] {
  transform: translateY(calc(100% + var(--safe-bottom, 0px)));
}

.hv-tabbar__inner {
  display: flex; align-items: stretch;
  height: var(--tabbar-height);
  background: var(--glass-fallback);
  box-shadow: var(--glass-shadow);
}
.hv-tabbar[data-shape="attached"] .hv-tabbar__inner {
  border-radius: 0;
  box-shadow: 0 -1px 0 var(--border-subtle);
}
.hv-tabbar[data-shape="floating"] {
  padding-left: calc(var(--safe-left, 0) + var(--space-4));
  padding-right: calc(var(--safe-right, 0) + var(--space-4));
  padding-bottom: calc(var(--safe-bottom, 0) + var(--space-3));
}
.hv-tabbar[data-shape="floating"] .hv-tabbar__inner {
  border-radius: var(--radius-pill);
  box-shadow: var(--glass-shadow-lift);
  padding: 0 var(--space-1);
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  @media (prefers-reduced-transparency: no-preference) {
    .hv-tabbar__inner {
      background: var(--glass-sand);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    }
    .hv-tabbar[data-variant="brand"] .hv-tabbar__inner { background: var(--glass-petrol); }
  }
}
.hv-tabbar[data-variant="solid"] .hv-tabbar__inner {
  background: var(--surface-card); -webkit-backdrop-filter: none; backdrop-filter: none;
}
.hv-tabbar[data-variant="brand"] .hv-tabbar__inner { background: var(--glass-fallback-brand); }

/* --- item --- */
.hv-tabbar__item {
  flex: 1 1 0; min-width: 0; position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; border: none; background: transparent; cursor: pointer;
  padding: 0 2px; color: var(--text-muted);
  min-height: var(--tap-comfort);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: color var(--dur-fast) var(--ease-standard);
}
.hv-tabbar__item:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -3px; border-radius: var(--radius-tap); }
.hv-tabbar[data-variant="brand"] .hv-tabbar__item { color: var(--text-on-brand-muted); }

/* A p\xEDlula One UI fica ATR\xC1S do \xEDcone, n\xE3o em volta do item inteiro. */
.hv-tabbar__icon {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 26px; border-radius: var(--radius-pill); flex: none;
  transition: background-color var(--dur-normal) var(--ease-spring),
              transform var(--dur-normal) var(--ease-spring);
}
.hv-tabbar__icon svg { width: 21px; height: 21px; display: block; }
.hv-tabbar__item[aria-current="page"] { color: var(--text-link); }
.hv-tabbar__item[aria-current="page"] .hv-tabbar__icon { background: var(--surface-brand-soft); }
.hv-tabbar[data-variant="brand"] .hv-tabbar__item[aria-current="page"] { color: var(--petrol-200); }
.hv-tabbar[data-variant="brand"] .hv-tabbar__item[aria-current="page"] .hv-tabbar__icon { background: var(--veil-fill); }
.hv-tabbar__item:active .hv-tabbar__icon { transform: scale(0.88); }

.hv-tabbar__label {
  font: var(--weight-semibold) var(--text-2xs)/1.1 var(--font-sans);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  letter-spacing: var(--tracking-normal);
}
/* Esconder rotulo NAO pode ser display:none. Isso tira o texto tambem da
   arvore de acessibilidade, e a aba vira um botao sem nome \u2014 no modo
   "never" isso valia para a barra INTEIRA, e no "active" para todas as
   abas menos uma. O icone nao substitui: e um SVG sem titulo.
   Some da tela, permanece para o leitor de tela. */
.hv-tabbar[data-labels="never"] .hv-tabbar__label,
.hv-tabbar[data-labels="active"] .hv-tabbar__item:not([aria-current="page"]) .hv-tabbar__label {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
}
.hv-tabbar[data-labels="never"] .hv-tabbar__icon { width: 52px; height: 34px; }

/* Badges sao Indicator \u2014 ver components/data-display/Indicator.jsx. */

/* --- estado LIVE: a assinatura da marca --- */
.hv-tabbar__item[data-live="true"] { color: var(--live-strong); }
.hv-tabbar__item[data-live="true"] .hv-tabbar__icon {
  background: var(--live-bg); animation: hv-pulse-live 2s var(--ease-standard) infinite;
}
.hv-tabbar__item[data-live="true"][aria-current="page"] { color: var(--live-strong); }
.hv-tabbar__item[data-live="true"][aria-current="page"] .hv-tabbar__icon { background: var(--live-bg); }

@media (prefers-reduced-motion: reduce) {
  .hv-tabbar, .hv-tabbar__icon { transition: none; }
  .hv-tabbar__item[data-live="true"] .hv-tabbar__icon { animation: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-tabbar-css")) {
  const el = document.createElement("style");
  el.id = "hv-tabbar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function TabBar({
  items = [],
  activeId,
  onSelect,
  variant = "glass",
  shape = "attached",
  labels = "always",
  position = "fixed",
  hideOnScroll = false,
  scrollRef = null,
  className = "",
  ariaLabel = "Navega\xE7\xE3o principal",
  ...rest
}) {
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    if (!hideOnScroll) {
      setHidden(false);
      return;
    }
    const target = scrollRef && scrollRef.current ? scrollRef.current : null;
    const node = target || (typeof window !== "undefined" ? window : null);
    if (!node) return;
    const read = () => target ? target.scrollTop : window.scrollY;
    let last = read();
    const onScroll = () => {
      const now = read();
      const delta = now - last;
      if (Math.abs(delta) < 8) return;
      setHidden(now > 56 && delta > 0);
      last = now;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [hideOnScroll, scrollRef]);
  const anel = variant === "brand" ? "var(--glass-fallback-brand)" : variant === "solid" ? "var(--surface-card)" : "var(--glass-fallback)";
  const handle = (item) => {
    if (item.disabled) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch (e) {
      }
    }
    if (item.onClick) item.onClick(item.id);
    if (onSelect) onSelect(item.id);
  };
  return /* @__PURE__ */ React.createElement(
    "nav",
    {
      className: ["hv-tabbar", className].filter(Boolean).join(" "),
      "data-variant": variant,
      "data-shape": shape,
      "data-labels": labels,
      "data-position": position,
      "data-hidden": String(hidden),
      "aria-label": ariaLabel,
      ...rest
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-tabbar__inner" }, items.map((item, i) => {
      const active = item.id === activeId;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: item.id || i,
          type: "button",
          className: "hv-tabbar__item",
          "aria-current": active ? "page" : void 0,
          "data-live": item.live ? "true" : void 0,
          disabled: item.disabled,
          onClick: () => handle(item)
        },
        /* @__PURE__ */ React.createElement("span", { className: "hv-tabbar__icon" }, active && item.activeIcon ? item.activeIcon : item.icon, /* @__PURE__ */ React.createElement(Indicator, { value: item.badge, ring: anel, tone: variant === "brand" ? "on-brand" : void 0 })),
        /* @__PURE__ */ React.createElement("span", { className: "hv-tabbar__label" }, item.label)
      );
    }))
  );
}
export {
  TabBar
};
