import React from "react";
import "./_field.js";
import { Button } from "../buttons/Button.js";
import { IconButton } from "../buttons/IconButton.js";
const CSS = `
.hv-copyfield { display: flex; align-items: center; gap: var(--space-1); box-sizing: border-box;
  border: var(--border-hair) solid var(--border-control); border-radius: var(--radius-md);
  background: var(--surface-card); padding: 3px var(--space-1) 3px 0;
  transition: border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard); }
.hv-copyfield:focus-within { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-copyfield__input { flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font: var(--text-sm)/1.2 var(--font-mono); color: var(--text-strong); padding: 9px 0 9px var(--space-3); text-overflow: ellipsis; }
.hv-copyfield__btn { flex: none; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-copyfield-css")) {
  const el = document.createElement("style");
  el.id = "hv-copyfield-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const CopyIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }));
const CheckIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "var(--emerald-600)", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" }));
const AlertIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "var(--danger-fg)", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), /* @__PURE__ */ React.createElement("path", { d: "M12 9v4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 17h.01" }));
async function copyText(text, html) {
  if (html && typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        })
      ]);
      return true;
    } catch (e) {
    }
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}
function CopyButton({
  value = "",
  html,
  label = "Copiar",
  copiedLabel = "Copiado",
  errorLabel = "N\xE3o foi poss\xEDvel copiar",
  onError,
  icon,
  iconOnly = false,
  variant,
  size = "md",
  timeout = 1600,
  onCopy,
  className = "",
  ...rest
}) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const timer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const handle = async () => {
    const texto = typeof value === "function" ? value() : value;
    const rico = typeof html === "function" ? html() : html;
    const ok = await copyText(texto, rico);
    clearTimeout(timer.current);
    if (!ok) {
      setFailed(true);
      onError && onError(new Error("N\xE3o foi poss\xEDvel acessar a \xE1rea de transfer\xEAncia"));
      timer.current = setTimeout(() => setFailed(false), timeout);
      return;
    }
    setFailed(false);
    setCopied(true);
    onCopy && onCopy(texto);
    timer.current = setTimeout(() => setCopied(false), timeout);
  };
  const ic = failed ? AlertIcon : copied ? CheckIcon : icon !== void 0 ? icon : CopyIcon;
  const rotulo = failed ? errorLabel : copied ? copiedLabel : label;
  if (iconOnly) {
    return /* @__PURE__ */ React.createElement(
      IconButton,
      {
        variant: variant || "quiet",
        size: size === "md" ? "sm" : size,
        className,
        label: rotulo,
        onClick: handle,
        ...rest
      },
      ic
    );
  }
  return /* @__PURE__ */ React.createElement(Button, { variant: variant || "secondary", size, iconLeft: ic, className, onClick: handle, ...rest }, rotulo);
}
let _cf = 0;
const nextId = () => `hv-cf-${++_cf}`;
function CopyField({
  value = "",
  // `html` era encaminhado para o CopyButton (linha do <CopyButton …/>) sem
  // nunca ter sido desestruturado aqui: um identificador solto no escopo do
  // modulo. Nao e prop faltando — e ReferenceError na renderizacao, entao o
  // CopyField nao montava DE JEITO NENHUM desde a 1.20.0. O .d.ts declara
  // `html` desde entao, o que fazia a auditoria de props passar: ela confere
  // que toda prop desestruturada esta tipada, e esta nao estava desestruturada.
  html,
  label,
  hint,
  error,
  required = false,
  copyLabel = "Copiar",
  copiedLabel = "Copiado",
  fallbackLabel = "Valor para copiar",
  onCopy,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const control = /* @__PURE__ */ React.createElement("div", { className: ["hv-copyfield", className].filter(Boolean).join(" "), ...rest }, /* @__PURE__ */ React.createElement(
    "input",
    {
      id: fieldId,
      className: "hv-copyfield__input",
      value,
      readOnly: true,
      spellCheck: false,
      onFocus: (e) => e.target.select(),
      "aria-label": typeof label === "string" ? label : fallbackLabel
    }
  ), /* @__PURE__ */ React.createElement(CopyButton, { className: "hv-copyfield__btn", value, html, iconOnly: true, label: copyLabel, copiedLabel, onCopy }));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  CopyButton,
  CopyField
};
