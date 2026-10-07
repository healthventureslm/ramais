import React from "react";
import { Select } from "../forms/Select.js";
import { Input } from "../forms/Input.js";
import { Badge } from "../data-display/Badge.js";
const CSS = `
.hv-scale { font-family: var(--font-sans); }
.hv-scale__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.hv-scale__item { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle); }
.hv-scale__item:first-child { padding-top: 0; }
.hv-scale__lbl { flex: 1; min-width: 0; }
.hv-scale__lbl b { display: block; font-size: var(--text-md); color: var(--text-strong); font-weight: var(--weight-semibold); }
.hv-scale__lbl span { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; line-height: var(--leading-snug); }
.hv-scale__field { flex: none; }
.hv-scale__num { text-align: center; font-family: var(--font-mono); }

.hv-scale__total { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); padding: 14px 18px;
  background: var(--surface-raised); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); }
.hv-scale__total-lbl { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-strong); text-transform: uppercase; letter-spacing: var(--tracking-wider); }
/* Mono, nao display bold. O total de uma escala clinica (Braden, Glasgow,
   Morse) e o numero que a pessoa confere e registra no prontuario \u2014 o caso
   literal da Regra do mono. Mesma correcao do StatCard e do DonutChart. */
.hv-scale__score { margin-left: auto; font-family: var(--font-mono); font-weight: var(--weight-medium); font-size: var(--text-2xl);
  letter-spacing: var(--tracking-snug); color: var(--text-strong); font-variant-numeric: tabular-nums; line-height: 1; }
.hv-scale__score small { font-size: var(--text-md); color: var(--text-muted); font-weight: var(--weight-medium); }
.hv-scale--disabled .hv-scale__lbl, .hv-scale--disabled .hv-scale__total { opacity: var(--opacity-disabled); }
.hv-scale--readonly { pointer-events: none; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-scale-css")) {
  const el = document.createElement("style");
  el.id = "hv-scale-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function ScoredScale({
  items = [],
  value,
  defaultValue,
  onChange,
  ranges,
  max,
  totalLabel = "Total",
  disabled = false,
  readOnly = false,
  className = "",
  ...rest
}) {
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue || {});
  const values = controlled ? value : internal;
  const keyOf = (it, i) => it.id != null ? it.id : i;
  const sum = (vals) => items.reduce((s, it, i) => {
    const x = vals[keyOf(it, i)];
    return s + (Number.isFinite(Number(x)) && x !== "" && x != null ? Number(x) : 0);
  }, 0);
  const total = sum(values);
  const setVal = (k, raw) => {
    if (disabled || readOnly) return;
    const v = raw === "" || raw == null ? "" : Number(raw);
    const next = { ...values, [k]: v };
    if (!controlled) setInternal(next);
    onChange && onChange(next, sum(next));
  };
  const autoMax = items.reduce((s, it) => {
    if (it.options && it.options.length) return s + Math.max(...it.options.map((o) => Number(o.value)));
    if (it.max != null) return s + Number(it.max);
    return s;
  }, 0);
  const totalMax = max != null ? max : autoMax || null;
  const classification = ranges && ranges.find(
    (r) => (r.min == null || total >= r.min) && (r.max == null || total <= r.max)
  );
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-scale", disabled ? "hv-scale--disabled" : "", readOnly ? "hv-scale--readonly" : "", className].filter(Boolean).join(" "),
      "aria-disabled": disabled || void 0,
      ...rest
    },
    /* @__PURE__ */ React.createElement("ul", { className: "hv-scale__items" }, items.map((it, i) => {
      const k = keyOf(it, i);
      const v = values[k] ?? "";
      return /* @__PURE__ */ React.createElement("li", { key: k, className: "hv-scale__item" }, /* @__PURE__ */ React.createElement("div", { className: "hv-scale__lbl" }, /* @__PURE__ */ React.createElement("b", null, it.label), it.hint != null && /* @__PURE__ */ React.createElement("span", null, it.hint)), /* @__PURE__ */ React.createElement("div", { className: "hv-scale__field", style: { width: it.options && it.options.length ? 212 : 96 } }, it.options && it.options.length ? /* @__PURE__ */ React.createElement(
        Select,
        {
          options: it.options.map((o) => ({ value: o.value, label: `${o.label} \xB7 ${o.value}` })),
          value: v,
          onChange: (val) => setVal(k, val),
          placeholder: "Selecione\u2026",
          disabled
        }
      ) : /* @__PURE__ */ React.createElement(
        Input,
        {
          type: "number",
          className: "hv-scale__num",
          min: it.min,
          max: it.max,
          step: it.step || 1,
          value: v,
          onChange: (e) => setVal(k, e.target.value),
          disabled,
          readOnly,
          "aria-label": typeof it.label === "string" ? it.label : void 0
        }
      )));
    })),
    /* @__PURE__ */ React.createElement("div", { className: "hv-scale__total" }, /* @__PURE__ */ React.createElement("span", { className: "hv-scale__total-lbl" }, totalLabel), classification && /* @__PURE__ */ React.createElement(Badge, { variant: classification.tone || "neutral" }, classification.label), /* @__PURE__ */ React.createElement("span", { className: "hv-scale__score" }, total, totalMax ? /* @__PURE__ */ React.createElement("small", null, " / ", totalMax) : null))
  );
}
export {
  ScoredScale
};
