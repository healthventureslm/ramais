import React from "react";
import { ChatLauncher } from "./ChatLauncher.js";
const CSS = `
.hv-chatwidget { position: fixed; z-index: 70; bottom: 24px; font-family: var(--font-sans); }
.hv-chatwidget--bottom-right { right: 24px; }
.hv-chatwidget--bottom-left { left: 24px; }

.hv-chatwidget__panel { position: absolute; bottom: 72px; display: flex; flex-direction: column; overflow: hidden;
  background: var(--surface-float); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);
  max-width: calc(100vw - 32px); max-height: 72vh;
  opacity: 0; transform: translateY(10px) scale(0.98); pointer-events: none;
  transition: opacity var(--dur-normal) var(--ease-entrance), transform var(--dur-normal) var(--ease-entrance); }
.hv-chatwidget--bottom-right .hv-chatwidget__panel { right: 0; transform-origin: bottom right; }
.hv-chatwidget--bottom-left .hv-chatwidget__panel { left: 0; transform-origin: bottom left; }
.hv-chatwidget--open .hv-chatwidget__panel { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

.hv-chatwidget__head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  padding: var(--space-3) 14px; border-bottom: 1px solid var(--border-subtle); background: var(--surface-brand); color: var(--text-on-brand); }
.hv-chatwidget__title { font: var(--weight-bold) var(--text-md)/1.2 var(--font-display); }
.hv-chatwidget__subtitle { font-size: var(--text-xs); color: var(--petrol-200); margin-top: 1px; }
@media (pointer: coarse) {
  .hv-chatwidget__close { width: var(--tap-min); height: var(--tap-min); }
}
.hv-chatwidget__close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border: none; background: transparent; color: var(--petrol-200); border-radius: var(--radius-md); cursor: pointer; transition: var(--transition-colors); }
.hv-chatwidget__close:hover { background: var(--veil-hover); color: var(--white); }
.hv-chatwidget__close:active { background: var(--veil-press); transition-duration: 0s; }
.hv-chatwidget__close:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-chatwidget__close svg { width: 18px; height: 18px; display: block; }

.hv-chatwidget__body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* A entrada do painel e geometria: quem pediu menos movimento recebe ele
   ja no lugar, aparecendo por opacidade. */
@media (prefers-reduced-motion: reduce) {
  .hv-chatwidget { transition: opacity var(--dur-fast) linear; }
  .hv-chatwidget[data-enter="false"] { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-chatwidget-css")) {
  const el = document.createElement("style");
  el.id = "hv-chatwidget-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props });
const CloseIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18" }), /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12" }));
function ChatWidget({
  open,
  defaultOpen = false,
  onOpenChange,
  title,
  subtitle,
  unread,
  launcherLabel,
  launcherIcon,
  position = "bottom-right",
  width = 370,
  height = 540,
  className = "",
  children,
  ...rest
}) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const isOpen = open !== void 0 ? open : internal;
  const setOpen = (v) => {
    if (open === void 0) setInternal(v);
    onOpenChange && onOpenChange(v);
  };
  const cls = ["hv-chatwidget", `hv-chatwidget--${position}`, isOpen ? "hv-chatwidget--open" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { className: cls, ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-chatwidget__panel", style: { width, height }, role: "dialog", "aria-modal": "false", "aria-hidden": !isOpen }, (title || subtitle) && /* @__PURE__ */ React.createElement("div", { className: "hv-chatwidget__head" }, /* @__PURE__ */ React.createElement("div", null, title && /* @__PURE__ */ React.createElement("div", { className: "hv-chatwidget__title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "hv-chatwidget__subtitle" }, subtitle)), /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-chatwidget__close", "aria-label": "Fechar", onClick: () => setOpen(false) }, CloseIcon)), /* @__PURE__ */ React.createElement("div", { className: "hv-chatwidget__body" }, children)), /* @__PURE__ */ React.createElement(
    ChatLauncher,
    {
      position: "inline",
      open: isOpen,
      unread: isOpen ? void 0 : unread,
      label: launcherLabel,
      icon: launcherIcon,
      onClick: () => setOpen(!isOpen)
    }
  ));
}
export {
  ChatWidget
};
