import React from "react";
import "./_field.js";
const CSS = `
.hv-check { display: inline-flex; align-items: flex-start; gap: 10px; font-family: var(--font-sans);
  cursor: pointer; user-select: none; }
.hv-check input { position: absolute; opacity: 0; width: 0; height: 0; }
.hv-check__box {
  flex: none; width: 20px; height: 20px; border-radius: var(--radius-sm);
  border: var(--border-thick) solid var(--border-control); background: var(--surface-card);
  display: inline-flex; align-items: center; justify-content: center; color: var(--action-primary-text);
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
  margin-top: 1px;
}
/* O controle sinaliza, nao so a mensagem \u2014 mesma regra dos campos de texto. */
.hv-check[data-invalid="true"] .hv-check__box { border-color: var(--danger-border); }
.hv-check__box svg { width: 14px; height: 14px; stroke-width: 3; opacity: 0;
  transform: scale(0.6); transition: opacity var(--dur-fast) var(--ease-standard),
  transform var(--dur-fast) var(--ease-entrance); }
.hv-check:hover input:not(:disabled) ~ .hv-check__box { border-color: var(--petrol-500); }
/* Press: a caixa AFUNDA (tinta) em vez de so mudar o contorno. Sem isto o
   controle acendia no hover e nao respondia ao clique. */
.hv-check:active input:not(:disabled) ~ .hv-check__box { background: var(--state-brand-press); border-color: var(--petrol-600); transition-duration: 0s; }
.hv-check:active input:not(:disabled):checked ~ .hv-check__box { background: var(--action-primary-press); border-color: var(--action-primary-press); }
.hv-check input:checked ~ .hv-check__box { background: var(--action-primary); border-color: var(--action-primary); }
.hv-check input:checked ~ .hv-check__box svg { opacity: 1; transform: scale(1); }
.hv-check input:focus-visible ~ .hv-check__box { box-shadow: var(--shadow-focus); }
.hv-check input:disabled ~ .hv-check__box { background: var(--surface-sunken); border-color: var(--border-default); }
.hv-check input:disabled ~ .hv-check__label { color: var(--text-muted); }
.hv-check--disabled { cursor: not-allowed; }
.hv-check__label { font-size: var(--text-md); color: var(--text-body); line-height: 1.3; }
.hv-check__label small { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }

/* O tique nasce em scale(0.6) e cresce. Sem movimento ele so aparece. */
@media (prefers-reduced-motion: reduce) {
  .hv-check__box svg { transition: opacity var(--dur-fast) linear; transform: none; }
  .hv-check input:checked ~ .hv-check__box svg { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-check-css")) {
  const el = document.createElement("style");
  el.id = "hv-check-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Checkbox({ label, description, error, required = false, disabled = false, className = "", ...rest }) {
  const marcado = /* @__PURE__ */ React.createElement(
    "label",
    {
      className: ["hv-check", disabled ? "hv-check--disabled" : "", className].filter(Boolean).join(" "),
      "data-invalid": error ? "true" : void 0
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        disabled,
        "aria-invalid": !!error,
        "aria-required": required || void 0,
        ...rest
      }
    ),
    /* @__PURE__ */ React.createElement("span", { className: "hv-check__box", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" }))),
    (label || description) && /* @__PURE__ */ React.createElement("span", { className: "hv-check__label" }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, " *"), description && /* @__PURE__ */ React.createElement("small", null, description))
  );
  if (!error) return marcado;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, marcado, /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error));
}
export {
  Checkbox
};
