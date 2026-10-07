import React from "react";
import "./_field.js";
import { Input } from "./Input.js";
let _tid = 0;
const nextId = () => `hv-ta-${++_tid}`;
function Textarea({
  label,
  hint,
  error,
  required = false,
  id,
  rows = 4,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const cls = ["hv-input", error ? "hv-input--invalid" : "", className].filter(Boolean).join(" ");
  const control = /* @__PURE__ */ React.createElement("textarea", { id: fieldId, rows, className: cls, "aria-invalid": !!error, "aria-required": required || void 0, "data-invalid": error ? "true" : void 0, ...rest });
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  Textarea
};
