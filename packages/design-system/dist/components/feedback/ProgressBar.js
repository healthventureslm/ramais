import React from "react";
const CSS = `
.hv-progress { font-family: var(--font-sans); width: 100%; }
.hv-progress__head { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: 6px; }
.hv-progress__label { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-body); }
.hv-progress__value { margin-left: auto; font-size: var(--text-xs); font-family: var(--font-mono); color: var(--text-muted); font-variant-numeric: tabular-nums; }

.hv-progress__track {
  position: relative; width: 100%; background: var(--surface-sunken);
  border-radius: var(--radius-pill); overflow: hidden;
}
.hv-progress__fill {
  height: 100%; min-width: 0; border-radius: var(--radius-pill);
  background: var(--_fill, var(--action-primary));
  transition: width var(--dur-normal) var(--ease-soft);
}

/* Sizes. O xs e um filete de 2px, para progresso ancorado no rodape de um
   chrome (NavBar, cabecalho de sheet) onde uma barra cheia pesaria demais.
   Sem crases aqui: este comentario vive DENTRO do template literal do CSS. */
.hv-progress--xs .hv-progress__track { height: 2px; border-radius: 0; }
.hv-progress--sm .hv-progress__track { height: 4px; }
.hv-progress--md .hv-progress__track { height: 8px; }
.hv-progress--lg .hv-progress__track { height: 12px; }

/* Semantic variants */
.hv-progress--brand    { --_fill: var(--action-primary); }
.hv-progress--positive { --_fill: var(--emerald-500); }
.hv-progress--warning  { --_fill: var(--amber-500); }
.hv-progress--danger   { --_fill: var(--crimson-500); }

/* Indeterminate: a sweeping bar when progress can't be measured */
.hv-progress--indeterminate .hv-progress__fill {
  position: absolute; left: 0; width: 40%;
  animation: hv-progress-indet 1.25s var(--ease-soft) infinite;
}
@keyframes hv-progress-indet { 0% { left: -42%; } 100% { left: 100%; } }

@media (prefers-reduced-motion: reduce) {
  .hv-progress__fill { transition: none; }
  .hv-progress--indeterminate .hv-progress__fill { animation: none; left: 0; width: 100%; opacity: 0.4; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-progress-css")) {
  const el = document.createElement("style");
  el.id = "hv-progress-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function ProgressBar({
  value,
  max = 100,
  variant = "brand",
  size = "md",
  label,
  showValue = false,
  valueFormat,
  indeterminate = false,
  id,
  className = "",
  ...rest
}) {
  const determinate = !indeterminate && value != null;
  const pct = determinate ? Math.max(0, Math.min(100, value / max * 100)) : 0;
  const valueText = determinate ? valueFormat ? valueFormat(value, max) : `${Math.round(pct)}%` : "";
  const rotuloId = id ? `${id}-label` : void 0;
  const cls = [
    "hv-progress",
    `hv-progress--${variant}`,
    `hv-progress--${size}`,
    indeterminate ? "hv-progress--indeterminate" : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { className: cls, id, ...rest }, (label != null || showValue && determinate) && /* @__PURE__ */ React.createElement("div", { className: "hv-progress__head" }, label != null && /* @__PURE__ */ React.createElement("span", { className: "hv-progress__label", id: rotuloId }, label), showValue && determinate && /* @__PURE__ */ React.createElement("span", { className: "hv-progress__value" }, valueText)), /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "hv-progress__track",
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": indeterminate ? void 0 : max,
      "aria-valuenow": determinate ? value : void 0,
      "aria-labelledby": label != null && rotuloId ? rotuloId : void 0,
      "aria-label": !rotuloId && typeof label === "string" ? label : void 0
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-progress__fill", style: indeterminate ? void 0 : { width: `${pct}%` } })
  ));
}
export {
  ProgressBar
};
