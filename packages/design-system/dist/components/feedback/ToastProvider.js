import React from "react";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import { Toast } from "./Toast.js";
const CSS = `
.hv-toaster { position: fixed; z-index: 9999; display: flex; flex-direction: column; gap: var(--space-3);
  max-width: 100vw; pointer-events: none; }
.hv-toaster--bottom-right  { right: 24px; bottom: 24px; align-items: flex-end; }
.hv-toaster--bottom-left   { left: 24px;  bottom: 24px; align-items: flex-start; }
.hv-toaster--top-right     { right: 24px; top: 24px;    align-items: flex-end; }
.hv-toaster--top-left      { left: 24px;  top: 24px;    align-items: flex-start; }
.hv-toaster--top-center    { left: 50%; top: 24px;    transform: translateX(-50%); align-items: center; }
.hv-toaster--bottom-center { left: 50%; bottom: 24px; transform: translateX(-50%); align-items: center; }

.hv-toaster__item { pointer-events: auto; will-change: transform, opacity;
  transition: opacity var(--dur-normal, .22s) var(--ease-standard), transform var(--dur-normal, .22s) var(--ease-standard); }
.hv-toaster__item[data-state="enter"]   { opacity: 0; transform: translateY(var(--_from, 8px)) scale(0.98); }
.hv-toaster__item[data-state="visible"] { opacity: 1; transform: translateY(0) scale(1); }
.hv-toaster__item[data-state="leaving"] { opacity: 0; transform: translateY(var(--_from, 8px)) scale(0.98); }
/* SAIDA \u2014 some sozinho, entao apaga devagar (DESIGN.md, secao 04).
   Em CSS a transicao usa a regra do estado de DESTINO: esta vale so quando o
   componente vai para fechado; a entrada continua na regra base. E troca a
   mola, que passa do ponto, por --ease-exit: nada deve quicar enquanto some. */
.hv-toaster__item[data-state="leaving"] { transition-duration: var(--dur-slow); transition-timing-function: var(--ease-exit); }
@media (prefers-reduced-motion: reduce) {
  .hv-toaster__item { transition: opacity var(--dur-fast, .12s) var(--ease-standard); }
  .hv-toaster__item[data-state="enter"], .hv-toaster__item[data-state="leaving"] { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-toaster-css")) {
  const el = document.createElement("style");
  el.id = "hv-toaster-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _seq = 0;
const listeners = /* @__PURE__ */ new Set();
let queue = [];
const emit = () => listeners.forEach((l) => l(queue));
const ALIAS = { success: "positive", error: "danger", warning: "warning", info: "info" };
function push(opts) {
  const o = typeof opts === "string" ? { title: opts } : opts || {};
  const id = o.id != null ? o.id : `hv-toast-${++_seq}`;
  const entry = {
    id,
    variant: ALIAS[o.variant] || o.variant || "info",
    title: o.title,
    description: o.description,
    duration: o.duration,
    // ms; undefined → provider default; 0 / Infinity → sticky
    action: o.action
  };
  const i = queue.findIndex((t) => t.id === id);
  queue = i >= 0 ? queue.map((t) => t.id === id ? entry : t) : [...queue, entry];
  emit();
  return id;
}
function dismissToast(id) {
  queue = id == null ? [] : queue.filter((t) => t.id !== id);
  emit();
}
function toast(opts) {
  return push(opts);
}
toast.success = (title, opts) => push({ ...opts, title, variant: "success" });
toast.error = (title, opts) => push({ ...opts, title, variant: "error" });
toast.warning = (title, opts) => push({ ...opts, title, variant: "warning" });
toast.info = (title, opts) => push({ ...opts, title, variant: "info" });
toast.dismiss = dismissToast;
function ToastItem({ data, position, duration, onDismiss }) {
  const [state, setState] = React.useState("enter");
  const timerRef = React.useRef(null);
  const leftRef = React.useRef(false);
  const fromTop = position.indexOf("top") === 0;
  const ms = data.duration != null ? data.duration : duration;
  React.useEffect(() => {
    const r = requestAnimationFrame(() => setState("visible"));
    return () => cancelAnimationFrame(r);
  }, []);
  const close = React.useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    setState("leaving");
    window.setTimeout(() => onDismiss(data.id), 320);
  }, [data.id, onDismiss]);
  const start = React.useCallback(() => {
    if (!ms || ms === Infinity) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(close, ms);
  }, [ms, close]);
  const pause = () => window.clearTimeout(timerRef.current);
  React.useEffect(() => {
    start();
    return () => window.clearTimeout(timerRef.current);
  }, [start]);
  const action = data.action ? { label: data.action.label, onClick: () => {
    data.action.onClick && data.action.onClick();
    close();
  } } : void 0;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "hv-toaster__item",
      "data-state": state,
      style: { "--_from": fromTop ? "-8px" : "8px" },
      onMouseEnter: pause,
      onMouseLeave: start,
      onFocus: pause,
      onBlur: start
    },
    /* @__PURE__ */ React.createElement(Toast, { variant: data.variant, title: data.title, action, onClose: close }, data.description)
  );
}
function ToastProvider({ position = "bottom-right", duration = 5e3, max, className = "" }) {
  const [items, setItems] = React.useState(queue);
  React.useEffect(() => {
    const l = (next) => setItems([...next]);
    listeners.add(l);
    setItems([...queue]);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const isTop = position.indexOf("top") === 0;
  const kept = max ? items.slice(-max) : items;
  React.useEffect(() => {
    if (!max || items.length <= max) return;
    items.slice(0, items.length - max).forEach((t) => dismissToast(t.id));
  }, [items, max]);
  const ordered = isTop ? [...kept].reverse() : kept;
  const stack = /* @__PURE__ */ React.createElement("div", { className: ["hv-toaster", `hv-toaster--${position}`, className].filter(Boolean).join(" "), role: "region", "aria-label": "Notifica\xE7\xF5es", "aria-live": "polite" }, ordered.map((t) => /* @__PURE__ */ React.createElement(ToastItem, { key: t.id, data: t, position, duration, onDismiss: dismissToast })));
  if (typeof document === "undefined") return stack;
  return createPortal(stack, document.body);
}
export {
  ToastProvider,
  toast
};
