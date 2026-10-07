import React from "react";
import { Button } from "../buttons/Button.js";
import { IconButton } from "../buttons/IconButton.js";
import { NavBar } from "../navigation/NavBar.js";
const CSS = `
.hv-pagehead { display: flex; align-items: flex-start; gap: var(--space-4);
  font-family: var(--font-sans); min-width: 0; }

.hv-pagehead__back { flex: none; margin-top: var(--nudge-2); }

/* Era um ICON TILE \u2014 quadrado arredondado de 44px, preenchido, com o glifo
   dentro. E o template universal de cabecalho gerado, e aparecia em tres
   componentes com tres tamanhos (Accordion 36, Drawer 40, PageHeader 44), sem
   que nenhum dos tres tivesse decidido o numero.

   O sistema ja tinha a resposta escrita duas vezes: o EmptyState ("sem circulo
   com icone dentro \u2014 o glifo e do tamanho do texto") e o StatCard ("o chip
   pastel virou GLIFO"). Aqui vale o mesmo. O glifo fica solto, na escala do
   titulo ao lado, e a caixa tem a altura da PRIMEIRA LINHA do titulo \u2014 e isso
   que o mantem alinhado ao texto em vez de centralizado num bloco de 44px. */
.hv-pagehead__icon {
  flex: none; display: inline-flex; align-items: center;
  height: calc(var(--text-2xl) * 1.15); color: var(--brand-soft-fg);
}
.hv-pagehead__icon svg { width: 24px; height: 24px; display: block; }

.hv-pagehead__text { flex: 1; min-width: 0; }

.hv-pagehead__eyebrow {
  /* --text-muted, nao --text-subtle: o subtle mede 4.18:1 sobre o canvas
     escuro, abaixo dos 4.5 que a AA pede para texto normal \u2014 e o eyebrow tem
     11px, nao e texto grande. O token subtle continua correto para o que ele
     e (rotulo decorativo); o erro era usa-lo num rotulo que CARREGA
     informacao, no nosso caso a data do plantao. */
  font: var(--weight-semibold) var(--text-2xs)/1 var(--font-sans);
  letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--text-muted);
  margin-bottom: var(--nudge-3);
}
.hv-pagehead__title {
  font: var(--weight-semibold) var(--text-2xl)/1.15 var(--font-display);
  color: var(--text-strong); letter-spacing: var(--tracking-tight); margin: 0;
}
.hv-pagehead__sub {
  font: var(--text-base)/1.5 var(--font-sans); color: var(--text-muted);
  margin: var(--space-1) 0 0; max-width: var(--reading-max);
}
.hv-pagehead__actions { flex: none; display: flex; align-items: center;
  gap: var(--space-2); margin-top: var(--nudge-2); }

/* --- escala greeting: o degrau do dashboard --- */
.hv-pagehead--greeting .hv-pagehead__title {
  font-size: var(--text-3xl); line-height: 1.1;
}
.hv-pagehead--greeting .hv-pagehead__sub { font-size: var(--text-lg); }

/* No mobile o cabe\xE7alho de p\xE1gina empilha: t\xEDtulo e a\xE7\xF5es lado a lado n\xE3o
   cabem em 360px sem truncar um dos dois. */
@media (max-width: 767px) {
  .hv-pagehead { flex-wrap: wrap; gap: var(--space-3); }
  .hv-pagehead__title { font-size: var(--text-xl); }
  .hv-pagehead--greeting .hv-pagehead__title { font-size: var(--text-2xl); }
  .hv-pagehead__sub { font-size: var(--text-md); }
  .hv-pagehead__actions { width: 100%; margin-top: var(--space-2); }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-pagehead-css")) {
  const el = document.createElement("style");
  el.id = "hv-pagehead-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ChevronLeft = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "m15 18-6-6 6-6" }));
function PageHeader({
  variant = "page",
  eyebrow,
  title,
  subtitle,
  icon,
  actions,
  back = false,
  backLabel,
  backTo,
  onBack,
  scrollRef = null,
  className = "",
  children,
  ...rest
}) {
  if (variant === "mobile") {
    return /* @__PURE__ */ React.createElement(
      NavBar,
      {
        title,
        subtitle,
        scrollRef,
        back: back || backTo ? { label: backLabel, onClick: onBack, href: backTo } : null,
        className,
        ...rest
      }
    );
  }
  return /* @__PURE__ */ React.createElement(
    "header",
    {
      className: ["hv-pagehead", `hv-pagehead--${variant}`, className].filter(Boolean).join(" "),
      ...rest
    },
    (back || backTo) && /* @__PURE__ */ React.createElement("span", { className: "hv-pagehead__back" }, /* @__PURE__ */ React.createElement(IconButton, { variant: "quiet", label: backLabel || "Voltar", href: backTo, onClick: onBack }, ChevronLeft)),
    icon && /* @__PURE__ */ React.createElement("span", { className: "hv-pagehead__icon", "aria-hidden": "true" }, icon),
    /* @__PURE__ */ React.createElement("div", { className: "hv-pagehead__text" }, eyebrow && /* @__PURE__ */ React.createElement("div", { className: "hv-pagehead__eyebrow" }, eyebrow), title && /* @__PURE__ */ React.createElement("h1", { className: "hv-pagehead__title" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "hv-pagehead__sub" }, subtitle), children),
    actions && /* @__PURE__ */ React.createElement("div", { className: "hv-pagehead__actions" }, actions)
  );
}
export {
  PageHeader
};
