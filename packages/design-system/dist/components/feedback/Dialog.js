import React from "react";
import { Sheet } from "../overlays/Sheet.js";
import { useViewport, resolvePortalTarget } from "../hooks/viewport.js";
import { useFocusTrap } from "../hooks/gestures.js";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-dialog__overlay {
  position: fixed; inset: 0; background: var(--surface-overlay); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: var(--space-6); z-index: 100;
}
.hv-dialog {
  background: var(--surface-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);
  width: 480px; max-width: 100%; max-height: calc(100vh - 48px); display: flex; flex-direction: column;
  overflow: hidden;
}
.hv-dialog--sm { width: 400px; } .hv-dialog--lg { width: 640px; }
.hv-dialog__header { display: flex; align-items: flex-start; gap: 14px; padding: 22px var(--space-6) 14px; }
.hv-dialog__icon { flex: none; width: 40px; height: 40px; border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center; background: var(--petrol-50); color: var(--petrol-600); }
.hv-dialog__icon svg { width: 21px; height: 21px; }
.hv-dialog__icon--danger { background: var(--danger-bg); color: var(--crimson-600); }
.hv-dialog__htext { flex: 1; }
.hv-dialog__title { font: var(--weight-semibold) var(--text-xl)/1.2 var(--font-display); color: var(--text-strong); letter-spacing: var(--tracking-snug); margin: 0; }
.hv-dialog__desc { font-size: var(--text-sm); color: var(--text-muted); margin: 5px 0 0; line-height: 1.45; }
.hv-dialog__close { flex: none; border: none; background: transparent; cursor: pointer; color: var(--text-subtle);
  padding: 6px; border-radius: var(--radius-sm); margin: -4px -6px 0 0; transition: var(--transition-colors); }
/* Unico botao do componente e o unico sem anel: caia no contorno padrao
   do navegador, que destoa do resto do sistema. */
.hv-dialog__close:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-dialog__close:hover { background: var(--state-hover); color: var(--text-strong); }
.hv-dialog__close:active { background: var(--state-press); transition-duration: 0s; }
.hv-dialog__close svg { width: 18px; height: 18px; display: block; }
.hv-dialog__body { padding: var(--space-1) var(--space-6) var(--space-2); overflow-y: auto; font-size: var(--text-md); color: var(--text-body); line-height: 1.5; }
.hv-dialog__footer { display: flex; justify-content: flex-end; gap: 10px; padding: 18px var(--space-6) 22px; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-dialog-css")) {
  const el = document.createElement("style");
  el.id = "hv-dialog-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Dialog({
  open = true,
  onClose,
  title,
  description,
  icon,
  danger = false,
  size = "md",
  footer,
  children,
  className = "",
  responsive = true,
  closeLabel = "Fechar",
  container
}) {
  const painelRef = React.useRef(null);
  useFocusTrap(open, painelRef);
  const { isMobile } = useViewport();
  const viraSheet = responsive && isMobile;
  if (!open) return null;
  if (viraSheet) {
    return /* @__PURE__ */ React.createElement(
      Sheet,
      {
        open,
        onClose,
        title,
        description,
        footer,
        container,
        className
      },
      children
    );
  }
  const content = (
    // `alertdialog` INTERROMPE o leitor de tela; `dialog` espera a pausa.
    // Um dialogo que pede confirmacao antes de apagar precisa interromper —
    // e por isso o ConfirmDialog passa `danger` para ca.
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "hv-dialog__overlay",
        onClick: onClose,
        role: danger ? "alertdialog" : "dialog",
        "aria-modal": "true"
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          ref: painelRef,
          className: ["hv-dialog", `hv-dialog--${size}`, className].filter(Boolean).join(" "),
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "hv-dialog__header" }, icon && /* @__PURE__ */ React.createElement("span", { className: ["hv-dialog__icon", danger ? "hv-dialog__icon--danger" : ""].filter(Boolean).join(" "), "aria-hidden": "true" }, icon), /* @__PURE__ */ React.createElement("div", { className: "hv-dialog__htext" }, title && /* @__PURE__ */ React.createElement("h2", { className: "hv-dialog__title" }, title), description && /* @__PURE__ */ React.createElement("p", { className: "hv-dialog__desc" }, description)), onClose && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-dialog__close", "aria-label": closeLabel, onClick: onClose }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" })))),
        children && /* @__PURE__ */ React.createElement("div", { className: "hv-dialog__body" }, children),
        footer && /* @__PURE__ */ React.createElement("div", { className: "hv-dialog__footer" }, footer)
      )
    )
  );
  const destino = resolvePortalTarget(container);
  return destino ? createPortal(content, destino) : content;
}
export {
  Dialog
};
