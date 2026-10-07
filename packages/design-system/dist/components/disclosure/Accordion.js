import React from "react";
const CSS = `
.hv-accordion { display: flex; flex-direction: column; gap: var(--space-2); font-family: var(--font-sans); }
.hv-accordion--flush { gap: 0; }
.hv-acc-item {
  background: var(--surface-card); border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg); overflow: hidden; transition: box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-accordion--flush .hv-acc-item { border-radius: 0; border-bottom: none; }
.hv-accordion--flush .hv-acc-item:first-child { border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg); }
.hv-accordion--flush .hv-acc-item:last-child { border-bottom: var(--border-hair) solid var(--border-subtle);
  border-bottom-left-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg); }
.hv-acc-item[data-open="true"] { box-shadow: var(--shadow-sm); border-color: var(--border-default); }

.hv-acc-trigger {
  display: flex; align-items: center; gap: 13px; width: 100%; box-sizing: border-box;
  padding: 15px var(--space-4); border: none; background: transparent; cursor: pointer; text-align: left;
  font-family: var(--font-sans); transition: var(--transition-colors);
}
.hv-acc-trigger:hover { background: var(--sand-50); }
.hv-acc-trigger:active { background: var(--state-press); transition-duration: 0s; }
.hv-acc-item[data-open="true"] .hv-acc-trigger { background: var(--sand-50); }
.hv-acc-trigger:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--focus-ring); }
/* Era um ICON TILE \u2014 quadrado arredondado de 36px, preenchido, com o glifo
   dentro. E o template universal de cabecalho gerado, e aparecia em tres
   componentes com tres tamanhos (Accordion 36, Drawer 40, PageHeader 44), sem
   que nenhum dos tres tivesse decidido o numero.

   O sistema ja tinha a resposta escrita duas vezes: o EmptyState ("sem circulo
   com icone dentro \u2014 o glifo e do tamanho do texto") e o StatCard ("o chip
   pastel virou GLIFO"). Aqui vale o mesmo. O glifo fica solto, na escala do
   titulo ao lado, e a caixa tem a altura da PRIMEIRA LINHA do titulo \u2014 e isso
   que o mantem alinhado ao texto em vez de centralizado num bloco de 44px. */
.hv-acc-icon { flex: none; align-self: flex-start; display: inline-flex; align-items: center;
  height: calc(var(--text-md) * 1.3); color: var(--text-muted);
  transition: var(--transition-colors); }
/* Aberto, o glifo ganha a tinta de marca \u2014 o sinal que antes era o fundo do tile. */
.hv-acc-item[data-open="true"] .hv-acc-icon { color: var(--brand-soft-fg); }
.hv-acc-icon svg { width: 18px; height: 18px; display: block; }
.hv-acc-head { flex: 1; min-width: 0; }
.hv-acc-title { display: block; font: 600 var(--text-md)/1.3 var(--font-display); color: var(--text-strong); letter-spacing: var(--tracking-snug); }
.hv-acc-item[data-open="true"] .hv-acc-title { color: var(--brand-soft-fg); }
.hv-acc-sub { display: block; font: var(--text-xs)/1.3 var(--font-sans); color: var(--text-muted); margin-top: 3px; }
.hv-acc-meta { flex: none; display: inline-flex; align-items: center; gap: var(--space-3); }
.hv-acc-chev { flex: none; color: var(--text-subtle); display: inline-flex; transition: transform var(--dur-normal) var(--ease-soft), color var(--dur-fast); }
.hv-acc-item[data-open="true"] .hv-acc-chev { transform: rotate(180deg); color: var(--petrol-600); }
.hv-acc-chev svg { width: 18px; height: 18px; display: block; }

.hv-acc-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-slow) var(--ease-standard); }
.hv-acc-item[data-open="true"] .hv-acc-region { grid-template-rows: 1fr; }
.hv-acc-inner { overflow: hidden; }
.hv-acc-body { padding: var(--space-4) 18px 18px 65px; font: var(--type-body-sm); color: var(--text-body); line-height: 1.6;
  border-top: var(--border-hair) solid var(--border-subtle); }
@media (prefers-reduced-motion: reduce) { .hv-acc-region { transition: none; } }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-accordion-css")) {
  const el = document.createElement("style");
  el.id = "hv-accordion-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Accordion({ items = [], multiple = false, defaultOpen = [], flush = false, className = "", ...rest }) {
  const [open, setOpen] = React.useState(() => new Set(Array.isArray(defaultOpen) ? defaultOpen : [defaultOpen]));
  const toggle = (key) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        if (!multiple) next.clear();
        next.add(key);
      }
      return next;
    });
  };
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-accordion", flush ? "hv-accordion--flush" : "", className].filter(Boolean).join(" "), ...rest }, items.map((it, i) => {
    const key = it.id ?? i;
    const isOpen = open.has(key);
    return /* @__PURE__ */ React.createElement("div", { className: "hv-acc-item", "data-open": isOpen, key }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-acc-trigger",
        "aria-expanded": isOpen,
        "aria-controls": `hv-acc-panel-${key}`,
        id: `hv-acc-trigger-${key}`,
        onClick: () => toggle(key)
      },
      it.icon && /* @__PURE__ */ React.createElement("span", { className: "hv-acc-icon" }, it.icon),
      /* @__PURE__ */ React.createElement("span", { className: "hv-acc-head" }, /* @__PURE__ */ React.createElement("span", { className: "hv-acc-title" }, it.title), it.subtitle && /* @__PURE__ */ React.createElement("span", { className: "hv-acc-sub" }, it.subtitle)),
      /* @__PURE__ */ React.createElement("span", { className: "hv-acc-meta" }, it.meta, /* @__PURE__ */ React.createElement("span", { className: "hv-acc-chev", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" }))))
    ), /* @__PURE__ */ React.createElement("div", { className: "hv-acc-region" }, /* @__PURE__ */ React.createElement("div", { className: "hv-acc-inner" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "hv-acc-body",
        id: `hv-acc-panel-${key}`,
        role: "region",
        "aria-labelledby": `hv-acc-trigger-${key}`
      },
      it.content
    ))));
  }));
}
export {
  Accordion
};
