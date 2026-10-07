import React from "react";
import { Button } from "../buttons/Button.js";
const CSS = `
.hv-toast {
  display: flex; align-items: flex-start; gap: var(--space-3); font-family: var(--font-sans);
  background: var(--surface-card); border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 14px 14px 14px var(--space-4);
  width: 360px; max-width: calc(100vw - 32px); position: relative; overflow: hidden;
}
/* Era um ::before absoluto de 4px na lateral esquerda \u2014 a aba lateral pela
   QUINTA vez no sistema, e escrita de um terceiro jeito: nem border-left (Card,
   Banner) nem box-shadow inset (Tag, LiveActivity, Snackbar), o que fez as duas
   varreduras anteriores passarem por cima dela. Com o overflow: hidden do
   container, os 4px ainda eram recortados pelo raio de 12px na mesma meia-lua.

   O tom ja vivia no glifo (--emerald-600 e companhia, logo abaixo). A barra era
   o terceiro mecanismo no mesmo elemento, junto do fio e da sombra. Fica o fio,
   tingido pelo tom: ele da a volta inteira e respeita o raio.

   Superficie CLARA pede tinta. O Snackbar, que e escuro, resolve o mesmo
   problema com luz \u2014 ver a nota la. */
.hv-toast--positive { border-color: color-mix(in srgb, var(--positive-border) 40%, var(--surface-card)); }
.hv-toast--warning  { border-color: color-mix(in srgb, var(--warning-border) 40%, var(--surface-card)); }
.hv-toast--danger   { border-color: color-mix(in srgb, var(--danger-border) 40%, var(--surface-card)); }
.hv-toast--info     { border-color: color-mix(in srgb, var(--info-border) 40%, var(--surface-card)); }
.hv-toast__icon { flex: none; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; }
.hv-toast__icon svg { width: 20px; height: 20px; }
/* O glifo e agora o portador principal do tom, entao ele sobe para o papel
   semantico em vez do degrau de rampa. */
.hv-toast--positive .hv-toast__icon { color: var(--positive-fg); }
.hv-toast--warning  .hv-toast__icon { color: var(--warning-fg); }
.hv-toast--danger   .hv-toast__icon { color: var(--danger-fg); }
.hv-toast--info     .hv-toast__icon { color: var(--info-fg); }
.hv-toast__body { flex: 1; min-width: 0; }
.hv-toast__title { font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--text-strong); }
.hv-toast__msg { font-size: var(--text-sm); color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
.hv-toast__action { margin-top: 10px; }
.hv-toast__close { flex: none; border: none; background: transparent; cursor: pointer;
  color: var(--text-subtle); padding: var(--space-1); border-radius: var(--radius-xs); margin: -4px -4px 0 0;
  transition: var(--transition-colors); }
/* Unico botao do componente e o unico sem anel: caia no contorno padrao
   do navegador, que destoa do resto do sistema. */
.hv-toast__close:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-toast__close:hover { background: var(--state-hover); color: var(--text-strong); }
.hv-toast__close:active { background: var(--state-press); transition-duration: 0s; }
.hv-toast__close svg { width: 16px; height: 16px; display: block; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-toast-css")) {
  const el = document.createElement("style");
  el.id = "hv-toast-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ICONS = {
  positive: /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" }),
  warning: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M12 9v4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 17h.01" }), /* @__PURE__ */ React.createElement("path", { d: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" })),
  danger: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M12 8v4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 16h.01" })),
  info: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M12 16v-4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 8h.01" }))
};
function Toast({ variant = "info", title, children, action, onClose, className = "", ...rest }) {
  const actionNode = !action ? null : React.isValidElement(action) ? action : /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "secondary", onClick: action.onClick }, action.label);
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-toast", `hv-toast--${variant}`, className].filter(Boolean).join(" "), role: "status", ...rest }, /* @__PURE__ */ React.createElement("span", { className: "hv-toast__icon", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" }, ICONS[variant])), /* @__PURE__ */ React.createElement("div", { className: "hv-toast__body" }, title && /* @__PURE__ */ React.createElement("div", { className: "hv-toast__title" }, title), children && /* @__PURE__ */ React.createElement("div", { className: "hv-toast__msg" }, children), actionNode && /* @__PURE__ */ React.createElement("div", { className: "hv-toast__action" }, actionNode)), onClose && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-toast__close", "aria-label": "Fechar", onClick: onClose }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" }))));
}
export {
  Toast
};
