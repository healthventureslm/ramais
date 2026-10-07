import React from "react";
import { SegmentedControl } from "../forms/SegmentedControl.js";
const CSS = `
.hv-trichk { font-family: var(--font-sans); }
.hv-trichk__item { display: flex; align-items: center; gap: var(--space-4); padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
.hv-trichk__item:first-child { padding-top: 0; }
.hv-trichk__lbl { flex: 1; min-width: 0; }
.hv-trichk__lbl b { font-size: var(--text-md); color: var(--text-strong); font-weight: var(--weight-medium); }
.hv-trichk__lbl span { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; line-height: var(--leading-snug); }
.hv-trichk__seg { flex: none; }
.hv-trichk--disabled .hv-trichk__lbl { opacity: var(--opacity-disabled); }
.hv-trichk--readonly { pointer-events: none; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-trichk-css")) {
  const el = document.createElement("style");
  el.id = "hv-trichk-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const DEFAULT_STATES = [
  { value: "sim", label: "Sim", tone: "positive" },
  { value: "nao", label: "N\xE3o", tone: "danger" },
  { value: "na", label: "N/A", tone: "neutral" }
];
function TriStateChecklist({
  items = [],
  value,
  defaultValue,
  onChange,
  states = DEFAULT_STATES,
  allowClear = true,
  disabled = false,
  readOnly = false,
  className = "",
  ...rest
}) {
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue || {});
  const values = controlled ? value : internal;
  const keyOf = (it, i) => it.id != null ? it.id : i;
  const options = states.map((s) => ({ value: s.value, label: s.label, tone: s.tone || "info" }));
  const setVal = (k, v) => {
    if (disabled || readOnly) return;
    const current = values[k];
    const nextVal = allowClear && current === v ? void 0 : v;
    const next = { ...values, [k]: nextVal };
    if (nextVal === void 0) delete next[k];
    if (!controlled) setInternal(next);
    onChange && onChange(next);
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-trichk", disabled ? "hv-trichk--disabled" : "", readOnly ? "hv-trichk--readonly" : "", className].filter(Boolean).join(" "),
      "aria-disabled": disabled || void 0,
      ...rest
    },
    items.map((it, i) => {
      const k = keyOf(it, i);
      return /* @__PURE__ */ React.createElement("div", { key: k, className: "hv-trichk__item" }, /* @__PURE__ */ React.createElement("div", { className: "hv-trichk__lbl" }, /* @__PURE__ */ React.createElement("b", null, it.label), it.hint != null && /* @__PURE__ */ React.createElement("span", null, it.hint)), /* @__PURE__ */ React.createElement(
        SegmentedControl,
        {
          className: "hv-trichk__seg",
          options,
          value: values[k] ?? "",
          onChange: (v) => setVal(k, v),
          disabled,
          "aria-label": typeof it.label === "string" ? it.label : void 0
        }
      ));
    })
  );
}
export {
  TriStateChecklist
};
