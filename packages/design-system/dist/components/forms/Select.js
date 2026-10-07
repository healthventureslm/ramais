import React from "react";
import { Sheet } from "../overlays/Sheet.js";
import { ListGroup, ListItem } from "../data-display/ListItem.js";
import { useViewport } from "../hooks/viewport.js";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "../_scroll.js";
import "./_field.js";
const CSS = `
.hv-select2 { position: relative; font-family: var(--font-sans); }
.hv-select2__trigger {
  display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box;
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-strong);
  background: var(--surface-card); border: var(--border-hair) solid var(--border-control);
  border-radius: var(--radius-md); height: 40px; padding: 0 var(--space-3); cursor: pointer; text-align: left;
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-select2__trigger:hover:not(:disabled):not([data-invalid]) { border-color: var(--border-control-hover); }
.hv-select2__trigger:focus-visible:not([data-invalid]) { outline: none; border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-select2[data-open="true"] .hv-select2__trigger:not([data-invalid]) { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
/* Aceitava a prop de erro, imprimia a mensagem e marcava aria-invalid \u2014 mas
   o controle nao mudava um pixel. Num formulario com quatro campos errados,
   metade sinalizava e metade nao. */
.hv-select2__trigger[data-invalid="true"] { border-color: var(--danger-border); }
.hv-select2__trigger[data-invalid="true"]:focus-visible { outline: none; box-shadow: var(--shadow-focus-danger); }
.hv-select2__trigger:disabled { background: var(--surface-sunken); color: var(--text-muted); cursor: not-allowed; }
.hv-select2__value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-select2__value--ph { color: var(--text-subtle); }
.hv-select2__chev { flex: none; color: var(--text-muted); display: inline-flex;
  transition: transform var(--dur-normal) var(--ease-soft), color var(--dur-fast) var(--ease-standard); }
.hv-select2__chev svg { width: 16px; height: 16px; display: block; }
.hv-select2[data-open="true"] .hv-select2__chev { transform: rotate(180deg); color: var(--petrol-600); }

.hv-select2__pop {
  position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 70;
  background: var(--surface-float); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 5px;
  max-height: 264px; overflow-y: auto; transform-origin: top center;
  opacity: 1; transform: translateY(0) scale(1);
  transition: transform var(--dur-fast) var(--ease-entrance);
}
.hv-select2__pop[data-enter="false"] { transform: translateY(-6px) scale(0.985); }
.hv-select2__pop--fixed { z-index: 200; }

.hv-select2__opt {
  display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box;
  padding: 9px 10px; border: none; background: transparent; cursor: pointer; text-align: left;  /* @escala-livre: a opcao alinha com o texto do controle que a abriu. */
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-body);
  border-radius: var(--radius-sm); transition: var(--transition-colors); line-height: 1.3;
}
.hv-select2__opt:hover, .hv-select2__opt[data-active="true"] { background: var(--state-brand-hover); color: var(--text-strong); }
.hv-select2__opt:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-select2__opt[data-selected="true"] { color: var(--petrol-700); font-weight: var(--weight-medium); }
.hv-select2__opt-check { flex: none; width: 16px; display: inline-flex; color: var(--petrol-600); opacity: 0; }
.hv-select2__opt[data-selected="true"] .hv-select2__opt-check { opacity: 1; }
.hv-select2__opt-check svg { width: 16px; height: 16px; stroke-width: 2.5; }
.hv-select2__opt-label { flex: 1; }
.hv-select2__empty { padding: 14px 10px; text-align: center; color: var(--text-muted); font-size: var(--text-sm); }

/* Dedo: 40px fica abaixo do --tap-min que o resto do DS respeita, e desde
   que os botoes passaram a crescer em ponteiro grosso o formulario ficava
   com campo de 40 e botao de 44 na mesma tela. Cresce so onde ha dedo. */
@media (pointer: coarse) {
  .hv-select2__trigger { height: var(--tap-min); }
}

/* A entrada do popover e geometria. Com menos movimento ele aparece ja no
   lugar, so por opacidade. */
@media (prefers-reduced-motion: reduce) {
  .hv-select2__pop { transition: opacity var(--dur-fast) linear; }
  .hv-select2__pop[data-enter="false"] { transform: none; }
  .hv-select2__chev svg { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-select2-css")) {
  const el = document.createElement("style");
  el.id = "hv-select2-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _s2 = 0;
const nextId = () => `hv-s2-${++_s2}`;
const norm = (o) => typeof o === "string" ? { value: o, label: o } : o;
function Select({
  emptyLabel = "Nenhuma op\xE7\xE3o",
  label,
  hint,
  error,
  required = false,
  options = [],
  placeholder = "Selecione\u2026",
  value,
  defaultValue,
  onChange,
  disabled = false,
  responsive = true,
  sheetTitle,
  container,
  id,
  className = "",
  ...rest
}) {
  const { isMobile } = useViewport();
  const fieldId = id || React.useMemo(nextId, []);
  const opts = options.map(norm);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = controlled ? value : internal;
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [pos, setPos] = React.useState(null);
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const selected = opts.find((o) => o.value === current);
  const place = React.useCallback(() => {
    const c = rootRef.current && rootRef.current.querySelector(".hv-select2__trigger");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const gap = 6, maxH = 270;
    const below = window.innerHeight - r.bottom;
    const up = below < maxH && r.top > below;
    setPos({ left: r.left, width: r.width, top: up ? null : r.bottom + gap, bottom: up ? window.innerHeight - r.top + gap : null });
  }, []);
  React.useEffect(() => {
    if (open) {
      place();
      const t = setTimeout(() => setEnter(true), 10);
      return () => clearTimeout(t);
    }
    setEnter(false);
  }, [open, place]);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(opts.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        pick(opts[active]);
      }
    };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, active, opts, place]);
  const viraSheet = responsive && isMobile;
  const pick = (o) => {
    if (!controlled) setInternal(o.value);
    onChange && onChange(o.value);
    setOpen(false);
  };
  const popContent = pos && /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: popRef,
      className: "hv-select2__pop hv-select2__pop--fixed hv-scroll",
      role: "listbox",
      tabIndex: -1,
      "data-enter": enter,
      style: { position: "fixed", left: pos.left, width: pos.width, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto" }
    },
    opts.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-select2__empty" }, emptyLabel),
    opts.map((o, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        key: o.value,
        role: "option",
        "aria-selected": o.value === current,
        className: "hv-select2__opt",
        "data-selected": o.value === current,
        "data-active": i === active,
        onMouseEnter: () => setActive(i),
        onClick: () => pick(o)
      },
      /* @__PURE__ */ React.createElement("span", { className: "hv-select2__opt-label" }, o.label),
      /* @__PURE__ */ React.createElement("span", { className: "hv-select2__opt-check", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" })))
    ))
  );
  const control = /* @__PURE__ */ React.createElement("div", { className: ["hv-select2", className].filter(Boolean).join(" "), "data-open": open, ref: rootRef }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      id: fieldId,
      className: "hv-select2__trigger",
      disabled,
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      "data-invalid": error ? "true" : void 0,
      onClick: () => {
        setOpen((o) => !o);
        setActive(opts.findIndex((o) => o.value === current));
      },
      ...rest
    },
    /* @__PURE__ */ React.createElement("span", { className: ["hv-select2__value", selected ? "" : "hv-select2__value--ph"].filter(Boolean).join(" ") }, selected ? selected.label : placeholder),
    /* @__PURE__ */ React.createElement("span", { className: "hv-select2__chev", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" })))
  ), !viraSheet && open && pos && (typeof document !== "undefined" ? createPortal(popContent, document.body) : popContent), viraSheet && /* @__PURE__ */ React.createElement(
    Sheet,
    {
      open,
      onClose: () => setOpen(false),
      title: sheetTitle || (typeof label === "string" ? label : void 0),
      detents: [0.6, 0.9],
      container
    },
    /* @__PURE__ */ React.createElement(ListGroup, { plain: true }, opts.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-select2__empty" }, emptyLabel), opts.map((o) => /* @__PURE__ */ React.createElement(
      ListItem,
      {
        key: o.value,
        title: o.label,
        active: o.value === current,
        onClick: () => pick(o),
        chevron: false,
        actions: o.value === current ? /* @__PURE__ */ React.createElement("span", { className: "hv-select2__opt-check", "data-on": "true", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(
          "svg",
          {
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeLinecap: "round",
            strokeLinejoin: "round"
          },
          /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" })
        )) : null
      }
    )))
  ));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  Select
};
