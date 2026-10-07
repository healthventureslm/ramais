import React from "react";
import { useFocusTrap } from "../hooks/gestures.js";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "../_scroll.js";
const CSS = `
.hv-drawer__overlay { position: fixed; inset: 0; background: var(--surface-overlay); z-index: 150;
  display: flex; opacity: 1; transition: opacity var(--dur-normal) var(--ease-standard); }
/* SAIDA \u2014 quem fecha e a pessoa, entao a saida responde ao gesto: nao fica
   mais lenta que a entrada. So troca a curva por --ease-exit. Ver secao 04. */
.hv-drawer__overlay[data-enter="false"] { opacity: 0; transition-timing-function: var(--ease-exit); }
.hv-drawer__overlay--right { justify-content: flex-end; }
.hv-drawer__overlay--left { justify-content: flex-start; }

.hv-drawer { background: var(--surface-card); height: 100%; display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl); width: 440px; max-width: 100vw; font-family: var(--font-sans);
  transition: transform var(--dur-slow) var(--ease-entrance); will-change: transform; }
.hv-drawer--sm { width: 360px; } .hv-drawer--lg { width: 560px; } .hv-drawer--xl { width: 720px; }
.hv-drawer__overlay--right .hv-drawer { transform: translateX(0); }
.hv-drawer__overlay--right[data-enter="false"] .hv-drawer { transform: translateX(100%); }
.hv-drawer__overlay--left .hv-drawer { transform: translateX(0); }
.hv-drawer__overlay--left[data-enter="false"] .hv-drawer { transform: translateX(-100%); }
/* Entra em --dur-slow; sai em --dur-normal, mais curto: responde ao gesto de fechar. */
.hv-drawer__overlay[data-enter="false"] .hv-drawer { transition: transform var(--dur-normal) var(--ease-exit); }

.hv-drawer__header { display: flex; align-items: flex-start; gap: 14px; padding: var(--space-5) 22px var(--space-4);
  border-bottom: var(--border-hair) solid var(--border-subtle); }
/* Era um ICON TILE \u2014 quadrado arredondado de 40px, preenchido, com o glifo
   dentro. E o template universal de cabecalho gerado, e aparecia em tres
   componentes com tres tamanhos (Accordion 36, Drawer 40, PageHeader 44), sem
   que nenhum dos tres tivesse decidido o numero.

   O sistema ja tinha a resposta escrita duas vezes: o EmptyState ("sem circulo
   com icone dentro \u2014 o glifo e do tamanho do texto") e o StatCard ("o chip
   pastel virou GLIFO"). Aqui vale o mesmo. O glifo fica solto, na escala do
   titulo ao lado, e a caixa tem a altura da PRIMEIRA LINHA do titulo \u2014 e isso
   que o mantem alinhado ao texto em vez de centralizado num bloco de 44px. */
.hv-drawer__icon { flex: none; align-self: center; display: inline-flex; align-items: center;
  color: var(--brand-soft-fg); }
.hv-drawer__icon svg { width: 22px; height: 22px; display: block; }
.hv-drawer__htext { flex: 1; min-width: 0; }
.hv-drawer__eyebrow { font: 600 var(--text-2xs)/1 var(--font-sans); letter-spacing: var(--tracking-wider); text-transform: uppercase;
  color: var(--text-muted); margin-bottom: 5px; }
.hv-drawer__title { font: 600 var(--text-xl)/1.2 var(--font-display); color: var(--text-strong); letter-spacing: var(--tracking-snug); margin: 0; }
.hv-drawer__sub { font: var(--text-sm)/1.4 var(--font-sans); color: var(--text-muted); margin: var(--space-1) 0 0; }
.hv-drawer__close { flex: none; border: none; background: transparent; cursor: pointer; color: var(--text-subtle);
  padding: 6px; border-radius: var(--radius-sm); margin: -4px -6px 0 0; transition: var(--transition-colors); }
/* Unico botao do componente e o unico sem anel: caia no contorno padrao
   do navegador, que destoa do resto do sistema. */
.hv-drawer__close:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-drawer__close:hover { background: var(--state-hover); color: var(--text-strong); }
.hv-drawer__close:active { background: var(--state-press); transition-duration: 0s; }
.hv-drawer__close svg { width: 18px; height: 18px; display: block; }
.hv-drawer__body { flex: 1; overflow-y: auto; padding: var(--space-5) 22px; }
.hv-drawer__footer { display: flex; justify-content: flex-end; gap: 10px; padding: var(--space-4) 22px;
  border-top: var(--border-hair) solid var(--border-subtle); }

@media (prefers-reduced-motion: reduce) {
  .hv-drawer { transition: opacity var(--dur-fast) linear; }
  .hv-drawer__overlay--right[data-enter="false"] .hv-drawer,
  .hv-drawer__overlay--left[data-enter="false"] .hv-drawer { transform: none; opacity: 0; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-drawer-css")) {
  const el = document.createElement("style");
  el.id = "hv-drawer-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Drawer({
  open = false,
  onClose,
  side = "right",
  size = "md",
  title,
  subtitle,
  eyebrow,
  icon,
  footer,
  children,
  className = ""
}) {
  const [mounted, setMounted] = React.useState(open);
  const [enter, setEnter] = React.useState(open);
  const overlayRef = React.useRef(null);
  useFocusTrap(open, overlayRef);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      setEnter(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);
  React.useEffect(() => {
    if (mounted && open) {
      if (overlayRef.current) void overlayRef.current.getBoundingClientRect();
      setEnter(true);
    }
  }, [mounted, open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  const content = /* @__PURE__ */ React.createElement("div", { ref: overlayRef, className: `hv-drawer__overlay hv-drawer__overlay--${side}`, "data-enter": enter, onClick: onClose, role: "dialog", "aria-modal": "true" }, /* @__PURE__ */ React.createElement("aside", { className: ["hv-drawer", `hv-drawer--${size}`, className].filter(Boolean).join(" "), onClick: (e) => e.stopPropagation() }, (title || icon || eyebrow) && /* @__PURE__ */ React.createElement("div", { className: "hv-drawer__header" }, icon && /* @__PURE__ */ React.createElement("span", { className: "hv-drawer__icon", "aria-hidden": "true" }, icon), /* @__PURE__ */ React.createElement("div", { className: "hv-drawer__htext" }, eyebrow && /* @__PURE__ */ React.createElement("div", { className: "hv-drawer__eyebrow" }, eyebrow), title && /* @__PURE__ */ React.createElement("h2", { className: "hv-drawer__title" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "hv-drawer__sub" }, subtitle)), onClose && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-drawer__close", "aria-label": "Fechar", onClick: onClose }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" })))), /* @__PURE__ */ React.createElement("div", { className: "hv-drawer__body hv-scroll" }, children), footer && /* @__PURE__ */ React.createElement("div", { className: "hv-drawer__footer" }, footer)));
  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
export {
  Drawer
};
