import React from "react";
import { Button } from "../buttons/Button.js";
import { IconButton } from "../buttons/IconButton.js";
import { ProgressBar } from "../feedback/ProgressBar.js";
import { Indicator } from "../data-display/Indicator.js";
const CSS = `
.hv-navbar {
  --_p: 0;                        /* progresso do colapso, 0 = expandido */
  position: sticky; top: 0; z-index: 60;
  display: flex; flex-direction: column;
  font-family: var(--font-sans);
  padding-top: var(--safe-top, 0);
  padding-left: var(--safe-left, 0); padding-right: var(--safe-right, 0);
  transition: box-shadow var(--dur-morph) var(--ease-standard);
}
.hv-navbar[data-position="fixed"] { position: fixed; left: 0; right: 0; }
.hv-navbar[data-position="static"] { position: relative; }

/* --- superf\xEDcies --- */
.hv-navbar[data-variant="solid"] { background: var(--surface-card); }
.hv-navbar[data-variant="brand"] { background: var(--surface-brand); color: var(--text-on-brand); }
.hv-navbar[data-variant="glass"] { background: var(--glass-fallback); }

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  @media (prefers-reduced-transparency: no-preference) {
    .hv-navbar[data-variant="glass"] {
      background: var(--glass-sand);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    }
  }
}

/* A hairline e a sombra s\xF3 aparecem quando h\xE1 conte\xFAdo por baixo \u2014 antes disso
   a barra deve parecer parte do fundo (scroll edge effect). */
/* Sem transition: a opacidade j\xE1 \xE9 dirigida continuamente pelo --_p do scroll.
   Transicionar por cima faz a hairline atrasar em rela\xE7\xE3o ao dedo. */
.hv-navbar::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: var(--border-subtle); opacity: var(--_p); pointer-events: none;
}
.hv-navbar[data-variant="brand"]::after { background: var(--glass-hairline-dim); }
.hv-navbar[data-elevated="true"] { box-shadow: var(--shadow-sm); }

/* --- linha compacta (sempre presente) --- */
.hv-navbar__row {
  height: var(--navbar-height, 52px); flex: none;
  display: flex; align-items: center; gap: var(--space-1);
  padding: 0 var(--space-2);
}
.hv-navbar__slot { display: flex; align-items: center; gap: 2px; flex: none; }
.hv-navbar__slot--start { min-width: var(--tap-min); justify-content: flex-start; }
.hv-navbar__slot--end   { min-width: var(--tap-min); justify-content: flex-end; }

/* T\xEDtulo compacto: entra em crossfade com o grande. As duas rampas se
   SOBREP\xD5EM de prop\xF3sito (grande apaga at\xE9 p=0.8, compacto acende a partir de
   p=0.5) \u2014 sem sobreposi\xE7\xE3o existe uma janela em que a barra fica sem t\xEDtulo
   nenhum, e o olho percebe isso como um piscar. */
.hv-navbar__compact {
  flex: 1; min-width: 0; text-align: center;
  opacity: clamp(0, calc((var(--_p) - 0.5) * 2.5), 1);
  transform: translateY(calc((1 - var(--_p)) * 6px));
}
.hv-navbar__compact-title {
  font: var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);
  color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: var(--tracking-snug);
}
.hv-navbar__compact-sub {
  font: var(--text-2xs)/1.2 var(--font-sans); color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;
}
.hv-navbar[data-variant="brand"] .hv-navbar__compact-title { color: var(--text-on-brand); }
.hv-navbar[data-variant="brand"] .hv-navbar__compact-sub { color: var(--text-on-brand-muted); }

/* Sem t\xEDtulo grande, o compacto fica sempre vis\xEDvel (o --_p \xE9 fixado em 1). */
.hv-navbar[data-large="false"] .hv-navbar__compact { opacity: 1; transform: none; }
.hv-navbar[data-large="false"][data-align="start"] .hv-navbar__compact { text-align: left; padding-left: var(--space-2); }

/* --- t\xEDtulo grande (One UI) --- */
.hv-navbar__large {
  overflow: hidden; flex: none;
  height: calc((1 - var(--_p)) * (var(--navbar-large-height, 116px) - var(--navbar-height, 52px)));
  padding: 0 var(--space-4);
  display: flex; flex-direction: column; justify-content: center;
  opacity: clamp(0, calc(1 - var(--_p) * 1.25), 1);
  transform: translateY(calc(var(--_p) * -10px));
  will-change: height, opacity, transform;
}
.hv-navbar__large-title {
  font: var(--weight-semibold) var(--text-2xl)/1.2 var(--font-display);
  color: var(--text-strong); letter-spacing: var(--tracking-tight); margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hv-navbar__large-sub {
  font: var(--text-sm)/1.35 var(--font-sans); color: var(--text-muted);
  margin: 3px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hv-navbar[data-variant="brand"] .hv-navbar__large-title { color: var(--text-on-brand); }
.hv-navbar[data-variant="brand"] .hv-navbar__large-sub { color: var(--text-on-brand-muted); }

/* --- slots de bot\xE3o ---------------------------------------------------
   Os controles s\xE3o IconButton (size="lg", 48px \u2014 acima do piso de 44) e
   Button quando o "voltar" leva r\xF3tulo. A NavBar N\xC3O reimplementa bot\xE3o e
   N\xC3O estiliza as classes deles por fora: precisar disso seria sinal de que
   falta uma variante no componente compartilhado, n\xE3o de que cabe um
   override aqui. O wrapper existe s\xF3 para ancorar o Indicator. */
.hv-navbar__btnwrap { position: relative; display: inline-flex; flex: none; }

/* --- barra de progresso ---
   O componente \xE9 o ProgressBar em size="xs"; a NavBar s\xF3 o ancora na base. */
.hv-navbar__progress { position: absolute; left: 0; right: 0; bottom: 0; }

@media (prefers-reduced-motion: reduce) {
  .hv-navbar__large, .hv-navbar__compact { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-navbar-css")) {
  const el = document.createElement("style");
  el.id = "hv-navbar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ChevronLeft = () => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "m15 18-6-6 6-6" }));
function NavBar({
  title,
  subtitle,
  largeTitle = true,
  back = null,
  actions = [],
  variant = "glass",
  position = "sticky",
  align = "start",
  scrollRef = null,
  progress = null,
  className = "",
  children,
  ...rest
}) {
  const barRef = React.useRef(null);
  const [elevated, setElevated] = React.useState(false);
  React.useEffect(() => {
    const target = scrollRef && scrollRef.current ? scrollRef.current : null;
    const bar = barRef.current;
    if (!bar) return;
    const read = () => target ? target.scrollTop : typeof window !== "undefined" ? window.scrollY : 0;
    let range = 1;
    const medir = () => {
      const styles = getComputedStyle(bar);
      const large = parseFloat(styles.getPropertyValue("--navbar-large-height")) || 100;
      const compact = parseFloat(styles.getPropertyValue("--navbar-height")) || 52;
      range = Math.max(1, large - compact);
    };
    medir();
    const apply = () => {
      const y = read();
      const p = largeTitle ? Math.min(1, Math.max(0, y / range)) : 1;
      bar.style.setProperty("--_p", String(p));
      setElevated(y > 2);
    };
    apply();
    const node = target || (typeof window !== "undefined" ? window : null);
    if (!node) return;
    const aoRedimensionar = () => {
      medir();
      apply();
    };
    node.addEventListener("scroll", apply, { passive: true });
    if (typeof window !== "undefined") window.addEventListener("resize", aoRedimensionar);
    return () => {
      node.removeEventListener("scroll", apply);
      if (typeof window !== "undefined") window.removeEventListener("resize", aoRedimensionar);
    };
  }, [scrollRef, largeTitle]);
  const anel = variant === "brand" ? "var(--surface-brand)" : variant === "glass" ? "var(--glass-fallback)" : "var(--surface-card)";
  const renderBtn = (cfg, i, kind) => /* @__PURE__ */ React.createElement("span", { className: "hv-navbar__btnwrap", key: cfg.id || i }, /* @__PURE__ */ React.createElement(
    IconButton,
    {
      variant: "quiet",
      size: "lg",
      onBrand: variant === "brand",
      label: cfg.label || cfg.ariaLabel || (kind === "back" ? "Voltar" : void 0),
      onClick: cfg.onClick,
      disabled: cfg.disabled
    },
    kind === "back" ? /* @__PURE__ */ React.createElement(ChevronLeft, null) : cfg.icon
  ), /* @__PURE__ */ React.createElement(Indicator, { value: cfg.badge, ring: anel, tone: variant === "brand" ? "on-brand" : void 0 }));
  return /* @__PURE__ */ React.createElement(
    "header",
    {
      ref: barRef,
      className: ["hv-navbar", className].filter(Boolean).join(" "),
      "data-variant": variant,
      "data-position": position,
      "data-large": String(Boolean(largeTitle && title)),
      "data-align": align,
      "data-elevated": String(elevated),
      ...rest
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__row" }, /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__slot hv-navbar__slot--start" }, back && (back.label ? /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "quiet",
        size: "lg",
        onClick: back.onClick,
        disabled: back.disabled,
        iconLeft: /* @__PURE__ */ React.createElement(ChevronLeft, null)
      },
      back.label
    ) : renderBtn(back, "back", "back"))), /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__compact" }, title && /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__compact-title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__compact-sub" }, subtitle)), /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__slot hv-navbar__slot--end" }, actions.map((a, i) => renderBtn(a, i, "action")))),
    largeTitle && title && /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__large" }, /* @__PURE__ */ React.createElement("h1", { className: "hv-navbar__large-title" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "hv-navbar__large-sub" }, subtitle)),
    children,
    progress != null && /* @__PURE__ */ React.createElement("div", { className: "hv-navbar__progress" }, /* @__PURE__ */ React.createElement(
      ProgressBar,
      {
        size: "xs",
        value: Math.min(1, Math.max(0, progress)) * 100,
        max: 100,
        label: null
      }
    ))
  );
}
export {
  NavBar
};
