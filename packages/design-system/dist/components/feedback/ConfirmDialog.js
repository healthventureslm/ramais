import React from "react";
import { Dialog } from "./Dialog.js";
import { Button } from "../buttons/Button.js";
const AlertIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), /* @__PURE__ */ React.createElement("path", { d: "M12 9v4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 17h.01" }));
function ConfirmDialog({
  open = true,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  icon,
  onConfirm,
  onCancel,
  children,
  className = ""
}) {
  const iconNode = icon !== void 0 ? icon : danger ? AlertIcon : null;
  return /* @__PURE__ */ React.createElement(
    Dialog,
    {
      open,
      onClose: loading ? void 0 : onCancel,
      title,
      description,
      danger,
      icon: iconNode,
      size: "sm",
      className,
      footer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: onCancel, disabled: loading }, cancelLabel), /* @__PURE__ */ React.createElement(Button, { variant: danger ? "danger" : "primary", onClick: onConfirm, loading }, confirmLabel))
    },
    children
  );
}
function useConfirm() {
  const [state, setState] = React.useState({ open: false, opts: {} });
  const resolverRef = React.useRef(null);
  const confirm = React.useCallback((opts = {}) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setState({ open: true, opts });
  }), []);
  const settle = React.useCallback((result) => {
    setState((s) => ({ ...s, open: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);
  const element = /* @__PURE__ */ React.createElement(
    ConfirmDialog,
    {
      open: state.open,
      ...state.opts,
      onConfirm: () => settle(true),
      onCancel: () => settle(false)
    }
  );
  return [confirm, element];
}
export {
  ConfirmDialog,
  useConfirm
};
