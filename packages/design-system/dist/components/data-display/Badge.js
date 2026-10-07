import React from "react";
const CSS = `
.hv-badge {
  display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-sans);
  font-weight: var(--weight-semibold); font-size: var(--text-2xs); line-height: 1;
  letter-spacing: var(--tracking-normal); padding: var(--space-1) 9px; border-radius: var(--radius-pill);
  white-space: nowrap; border: var(--border-hair) solid transparent;
  /* Largura natural que sobrevive ao pai. inline-flex sozinho nao basta:
     como item de um flex column o elemento e esticado no eixo cruzado e
     blockifica para flex \u2014 a pilula viraria uma faixa de ponta a ponta.
     Em ChipGroup nao muda nada: la o eixo e linha, entao o stretch mexia
     na altura, nunca na largura. */
  width: fit-content;
}
.hv-badge svg { width: 12px; height: 12px; }
.hv-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.hv-badge--neutral  { background: var(--surface-sunken); color: var(--text-body); }
.hv-badge--positive { background: var(--positive-bg); color: var(--positive-fg); }
.hv-badge--warning  { background: var(--warning-bg);  color: var(--warning-fg); }
.hv-badge--danger   { background: var(--danger-bg);   color: var(--danger-fg); }
.hv-badge--info     { background: var(--info-bg);     color: var(--info-fg); }
.hv-badge--live     { background: var(--live-bg);     color: var(--live-strong); }
.hv-badge--brand    { background: var(--surface-brand);  color: var(--text-on-brand); }

/* outline style */
.hv-badge--outline.hv-badge--neutral  { background: transparent; border-color: var(--border-strong); }
.hv-badge--outline.hv-badge--positive { background: transparent; border-color: var(--emerald-500); }
.hv-badge--outline.hv-badge--warning  { background: transparent; border-color: var(--amber-500); }
.hv-badge--outline.hv-badge--danger   { background: transparent; border-color: var(--crimson-500); }
.hv-badge--outline.hv-badge--info     { background: transparent; border-color: var(--petrol-400); }

.hv-badge__pulse { width: 7px; height: 7px; border-radius: 50%; background: currentColor;
  animation: hv-pulse-live 1.6s var(--ease-soft) infinite; }
/* O pulso e o unico movimento do Badge, e e infinito \u2014 exatamente o tipo que
   incomoda quem pede menos movimento. Parado ele continua sendo um ponto. */
@media (prefers-reduced-motion: reduce) {
  .hv-badge__pulse { animation: none; }
}

/* Remover \u2014 o Badge tinha a semantica certa (danger, warning...) e nao tinha
   como sair. O caso real e o chip de ALERGIA: e removivel E e danger, porque
   ali a cor nao e categoria, e gravidade. Tag resolve o removivel mas a doc do
   sistema proibe usar par semantico para categoria, entao nenhum dos dois
   cobria. Agora cobre.
   O X herda currentColor, entao acompanha a variante sozinho. */
.hv-badge__remove {
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; cursor: pointer; padding: 0;
  margin: -2px -3px -2px 1px; width: 15px; height: 15px; flex: none;
  border-radius: var(--radius-xs); color: currentColor; opacity: 0.65;
  transition: var(--transition-colors), opacity var(--dur-fast) var(--ease-standard);
}
/* Era rgba(0,0,0,0.08) \u2014 o unico preto cru do sistema, e sem versao
   escura: sobre um badge tingido no tema escuro o veu preto some e o x
   fica sem hover. color-mix com currentColor resolve nos dois temas de
   uma vez, porque o badge ja carrega a propria tinta de texto. */
.hv-badge__remove:hover { opacity: 1; background: color-mix(in srgb, currentColor 14%, transparent); }
.hv-badge__remove:active { background: color-mix(in srgb, currentColor 26%, transparent); transition-duration: 0s; }
.hv-badge__remove:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; opacity: 1; }
.hv-badge__remove svg { width: 11px; height: 11px; display: block; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-badge-css")) {
  const el = document.createElement("style");
  el.id = "hv-badge-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Badge({
  variant = "neutral",
  outline = false,
  dot = false,
  pulse = false,
  onRemove,
  removeLabel = "Remover",
  className = "",
  children,
  ...rest
}) {
  const cls = ["hv-badge", `hv-badge--${variant}`, outline ? "hv-badge--outline" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("span", { className: cls, ...rest }, pulse ? /* @__PURE__ */ React.createElement("span", { className: "hv-badge__pulse", "aria-hidden": "true" }) : dot && /* @__PURE__ */ React.createElement("span", { className: "hv-badge__dot", "aria-hidden": "true" }), children, onRemove && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-badge__remove",
      onClick: onRemove,
      "aria-label": typeof children === "string" ? `${removeLabel} ${children}` : removeLabel
    },
    /* @__PURE__ */ React.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true"
      },
      /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" })
    )
  ));
}
export {
  Badge
};
