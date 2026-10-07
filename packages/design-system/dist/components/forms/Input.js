import React from "react";
import "./_field.js";
const CSS = `
.hv-input-wrap { position: relative; display: flex; align-items: center; }
.hv-input-wrap__icon {
  position: absolute; display: inline-flex; color: var(--text-subtle); pointer-events: none;
}
.hv-input-wrap__icon--left { left: 12px; }
.hv-input-wrap__icon--right { right: 12px; }
.hv-input-wrap__icon svg { width: 17px; height: 17px; display: block; }

.hv-input {
  width: 100%; box-sizing: border-box; font-family: var(--font-sans); font-size: var(--text-md);
  color: var(--text-strong); background: var(--surface-card);
  border: var(--border-hair) solid var(--border-control); border-radius: var(--radius-md);
  height: 40px; padding: 0 var(--space-3); transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-input::placeholder { color: var(--text-subtle); }
.hv-input:hover:not(:disabled):not(:focus):not([data-invalid]) { border-color: var(--border-control-hover); }
.hv-input:focus:not([data-invalid]) { outline: none; border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-input:disabled { background: var(--surface-sunken); color: var(--text-muted); cursor: not-allowed; }
.hv-input--has-left { padding-left: 36px; }
.hv-input--has-right { padding-right: 36px; }

/* Dedo: 40px fica abaixo do --tap-min que o resto do DS respeita, e desde
   que os botoes passaram a crescer em ponteiro grosso o formulario ficava
   com campo de 40 e botao de 44 na mesma tela. Cresce so onde ha dedo. */
@media (pointer: coarse) {
  .hv-input, textarea.hv-input { height: var(--tap-min); }
}

/* O erro TEM de sobreviver a interacao. Sem os :not([data-invalid]) acima,
   o hover trocava a borda vermelha por ink-500 e o foco por petrol \u2014 o campo
   parava de sinalizar exatamente quando a pessoa ia corrigi-lo. E o anel
   usava --danger-bg, que e a TINTA DE FUNDO: no escuro, #3A1A16 sobre cartao
   escuro nao se ve. Agora e o mesmo anel de perigo do botao. */
.hv-input[data-invalid="true"] { border-color: var(--danger-border); }
.hv-input[data-invalid="true"]:focus { outline: none; box-shadow: var(--shadow-focus-danger); }

textarea.hv-input { height: auto; min-height: 88px; padding: 10px var(--space-3); line-height: var(--leading-normal); resize: vertical; }  /* @escala-livre: contrato de 13,0px de inicio de conteudo e 40px de altura entre Input, Select, Combobox, MultiSelect e DatePicker. Cada um chega la por padding diferente porque a estrutura interna e diferente; medido em tests/forms-playground.html. */
`;
if (typeof document !== "undefined" && !document.getElementById("hv-input-css")) {
  const el = document.createElement("style");
  el.id = "hv-input-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _id = 0;
const nextId = () => `hv-in-${++_id}`;
function Input({
  label,
  hint,
  error,
  required = false,
  iconLeft = null,
  iconRight = null,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const inputCls = [
    "hv-input",
    iconLeft ? "hv-input--has-left" : "",
    iconRight ? "hv-input--has-right" : "",
    error ? "hv-input--invalid" : "",
    className
  ].filter(Boolean).join(" ");
  const field = /* @__PURE__ */ React.createElement("div", { className: "hv-input-wrap" }, iconLeft && /* @__PURE__ */ React.createElement("span", { className: "hv-input-wrap__icon hv-input-wrap__icon--left" }, iconLeft), /* @__PURE__ */ React.createElement("input", { id: fieldId, className: inputCls, "aria-invalid": !!error, "aria-required": required || void 0, "data-invalid": error ? "true" : void 0, ...rest }), iconRight && /* @__PURE__ */ React.createElement("span", { className: "hv-input-wrap__icon hv-input-wrap__icon--right" }, iconRight));
  if (!label && !hint && !error) return field;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), field, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  Input
};
