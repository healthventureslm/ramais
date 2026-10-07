import React from "react";
import "./_field.js";
const CSS = `
.hv-radiogroup { display: flex; flex-direction: column; gap: 9px; font-family: var(--font-sans); }
.hv-radiogroup__legend { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-strong); margin-bottom: 2px; }
.hv-radiogroup--cards { gap: 10px; }

.hv-radio { display: flex; align-items: flex-start; gap: 11px; cursor: pointer; user-select: none; }
.hv-radio input { position: absolute; opacity: 0; width: 0; height: 0; }
.hv-radio__dot { flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--surface-card);
  border: 2px solid var(--border-control); display: inline-flex; align-items: center; justify-content: center;
  margin-top: 1px; transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard); }
/* O ponto interno cai sobre --action-primary. Era #fff cravado: no escuro
   o verde CLAREIA e o branco por cima perde contraste. E a mesma regra do
   tique do Checkbox, que ja usava o papel certo. */
.hv-radio__dot::after { content: ""; width: 9px; height: 9px; border-radius: 50%; background: var(--action-primary-text);
  transform: scale(0); transition: transform var(--dur-fast) var(--ease-entrance); }
.hv-radio:hover input:not(:disabled) ~ .hv-radio__dot { border-color: var(--petrol-500); }
.hv-radio:active input:not(:disabled) ~ .hv-radio__dot { background: var(--state-brand-press); border-color: var(--petrol-600); transition-duration: 0s; }
.hv-radio:active input:not(:disabled):checked ~ .hv-radio__dot { background: var(--action-primary-press); border-color: var(--action-primary-press); }
.hv-radio input:checked ~ .hv-radio__dot { background: var(--action-primary); border-color: var(--action-primary); }
.hv-radio input:checked ~ .hv-radio__dot::after { transform: scale(1); }
.hv-radio input:focus-visible ~ .hv-radio__dot { box-shadow: var(--shadow-focus); }
.hv-radio input:disabled ~ .hv-radio__dot { background: var(--surface-sunken); border-color: var(--border-default); }
/* Grupo invalido: o controle sinaliza junto com a mensagem. */
.hv-radiogroup[data-invalid="true"] .hv-radio__dot { border-color: var(--danger-border); }
.hv-radio--disabled { cursor: not-allowed; }
.hv-radio--disabled .hv-radio__label { color: var(--text-muted); }
.hv-radio__label { font-size: var(--text-md); color: var(--text-body); line-height: 1.35; }
.hv-radio__label small { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }

/* Card style */
.hv-radio--card { border: var(--border-hair) solid var(--border-control); border-radius: var(--radius-lg);
  padding: 13px 15px; background: var(--surface-card); transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard); }
.hv-radio--card:hover:not(.hv-radio--disabled) { border-color: var(--border-control-hover); }
.hv-radio--card:active:not(.hv-radio--disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-radio--card[data-checked="true"]:active:not(.hv-radio--disabled) { background: var(--state-brand-press); }
.hv-radio--card[data-checked="true"] { border-color: var(--petrol-500); background: var(--petrol-50); box-shadow: 0 0 0 1px var(--petrol-500); }
.hv-radio--card .hv-radio__label { font-weight: var(--weight-medium); color: var(--text-strong); }

@media (prefers-reduced-motion: reduce) {
  .hv-radio__dot::after { transition: opacity var(--dur-fast) linear; transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-radiogroup-css")) {
  const el = document.createElement("style");
  el.id = "hv-radiogroup-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _rg = 0;
const nextName = () => `hv-rg-${++_rg}`;
const norm = (o) => typeof o === "string" ? { value: o, label: o } : o;
function RadioGroup({
  label,
  name,
  options = [],
  value,
  defaultValue,
  onChange,
  error,
  required = false,
  variant = "default",
  disabled = false,
  className = "",
  ...rest
}) {
  const groupName = React.useMemo(() => name || nextName(), [name]);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = controlled ? value : internal;
  const opts = options.map(norm);
  const pick = (v) => {
    if (!controlled) setInternal(v);
    onChange && onChange(v);
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-radiogroup", variant === "cards" ? "hv-radiogroup--cards" : "", className].filter(Boolean).join(" "),
      role: "radiogroup",
      "aria-label": typeof label === "string" ? label : void 0,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      "data-invalid": error ? "true" : void 0,
      ...rest
    },
    label && /* @__PURE__ */ React.createElement("span", { className: "hv-radiogroup__legend" }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, " *")),
    opts.map((o) => {
      const dis = disabled || o.disabled;
      const sel = current === o.value;
      const cardStyle = variant === "cards" && sel ? {
        borderColor: "var(--petrol-500)",
        background: "var(--petrol-50)",
        boxShadow: "0 0 0 1px var(--petrol-500)"
      } : void 0;
      return /* @__PURE__ */ React.createElement("label", { key: o.value, "data-checked": sel, style: cardStyle, className: ["hv-radio", variant === "cards" ? "hv-radio--card" : "", dis ? "hv-radio--disabled" : ""].filter(Boolean).join(" ") }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "radio",
          name: groupName,
          value: o.value,
          checked: current === o.value,
          disabled: dis,
          onChange: () => pick(o.value)
        }
      ), /* @__PURE__ */ React.createElement("span", { className: "hv-radio__dot", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("span", { className: "hv-radio__label" }, o.label, o.description && /* @__PURE__ */ React.createElement("small", null, o.description)));
    }),
    error && /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error)
  );
}
export {
  RadioGroup
};
