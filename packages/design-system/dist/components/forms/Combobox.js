import React from "react";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "../_scroll.js";
import "./_field.js";
const CSS = `
.hv-combo { position: relative; font-family: var(--font-sans); }
.hv-combo__control {
  display: flex; align-items: center; gap: var(--space-2); width: 100%; box-sizing: border-box;
  background: var(--surface-card); border: var(--border-hair) solid var(--border-control);
  border-radius: var(--radius-md); height: 40px; padding: 0 10px 0 var(--space-3); cursor: text;  /* @escala-livre: contrato de 13,0px de inicio de conteudo e 40px de altura entre Input, Select, Combobox, MultiSelect e DatePicker. Cada um chega la por padding diferente porque a estrutura interna e diferente; medido em tests/forms-playground.html. */
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-combo__control:hover:not([data-invalid]) { border-color: var(--border-control-hover); }
/* O anel dependia de o popover ESTAR ABERTO: entrar por Tab num combobox
   fechado nao acendia nada, e quem navega por teclado nao sabia onde estava.
   :focus-within cobre o input interno, que e quem de fato recebe o foco. */
.hv-combo[data-open="true"] .hv-combo__control:not([data-invalid]),
.hv-combo__control:focus-within:not([data-invalid]) { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-combo__control[data-invalid="true"] { border-color: var(--danger-border); }
.hv-combo__control[data-invalid="true"]:focus-within { box-shadow: var(--shadow-focus-danger); }
.hv-combo__lead { flex: none; color: var(--text-subtle); display: inline-flex; }
.hv-combo__lead svg { width: 17px; height: 17px; }
.hv-combo__input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-strong);
}
.hv-combo__input::placeholder { color: var(--text-subtle); }
.hv-combo__chev { flex: none; color: var(--text-muted); display: inline-flex;
  transition: transform var(--dur-normal) var(--ease-soft); }
.hv-combo__chev svg { width: 16px; height: 16px; display: block; }
.hv-combo[data-open="true"] .hv-combo__chev { transform: rotate(180deg); color: var(--petrol-600); }
.hv-combo__clear { flex: none; border: none; background: transparent; cursor: pointer; color: var(--text-subtle);
  padding: 3px; border-radius: var(--radius-xs); display: inline-flex; transition: var(--transition-colors); }
.hv-combo__clear:hover { background: var(--state-press); color: var(--text-strong); }
.hv-combo__clear:active { background: var(--state-press-deep); transition-duration: 0s; }
.hv-combo__clear svg { width: 14px; height: 14px; }

.hv-combo__pop {
  position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 70;
  background: var(--surface-float); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 5px;
  max-height: 276px; overflow-y: auto; transform-origin: top center;
  opacity: 1; transform: translateY(0) scale(1);
  transition: transform var(--dur-fast) var(--ease-entrance);
}
.hv-combo__pop[data-enter="false"] { transform: translateY(-6px) scale(0.985); }
.hv-combo__pop--fixed { z-index: 200; }

.hv-combo__opt {
  display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box;
  padding: 9px 10px; border: none; background: transparent; cursor: pointer; text-align: left;  /* @escala-livre: a opcao alinha com o texto do controle que a abriu. */
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-body);
  border-radius: var(--radius-sm); transition: var(--transition-colors); line-height: 1.3;
}
.hv-combo__opt:hover, .hv-combo__opt[data-active="true"] { background: var(--state-brand-hover); color: var(--text-strong); }
.hv-combo__opt:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-combo__opt[data-selected="true"] { color: var(--petrol-700); font-weight: var(--weight-medium); }
.hv-combo__opt-main { flex: 1; min-width: 0; }
.hv-combo__opt-label { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-combo__opt-desc { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-top: 1px; }
.hv-combo__opt-check { flex: none; width: 16px; display: inline-flex; color: var(--petrol-600); opacity: 0; }
.hv-combo__opt[data-selected="true"] .hv-combo__opt-check { opacity: 1; }
.hv-combo__opt-check svg { width: 16px; height: 16px; stroke-width: 2.5; }
.hv-combo__empty { padding: var(--space-4) 10px; text-align: center; color: var(--text-muted); font-size: var(--text-sm); }
.hv-combo__mark { background: var(--petrol-100); color: var(--brand-soft-fg); border-radius: 3px; padding: 0 1px; }

/* Dedo: 40px fica abaixo do --tap-min que o resto do DS respeita, e desde
   que os botoes passaram a crescer em ponteiro grosso o formulario ficava
   com campo de 40 e botao de 44 na mesma tela. Cresce so onde ha dedo. */
@media (pointer: coarse) {
  .hv-combo__control { height: var(--tap-min); }
}

/* A entrada do popover e geometria. Com menos movimento ele aparece ja no
   lugar, so por opacidade. */
@media (prefers-reduced-motion: reduce) {
  .hv-combo__pop { transition: opacity var(--dur-fast) linear; }
  .hv-combo__pop[data-enter="false"] { transform: none; }
  .hv-combo__chev svg { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-combo-css")) {
  const el = document.createElement("style");
  el.id = "hv-combo-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _cb = 0;
const nextId = () => `hv-cb-${++_cb}`;
const norm = (o) => typeof o === "string" ? { value: o, label: o } : o;
function Highlight({ text, q }) {
  if (!q) return text;
  const i = String(text).toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  const s = String(text);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, s.slice(0, i), /* @__PURE__ */ React.createElement("span", { className: "hv-combo__mark" }, s.slice(i, i + q.length)), s.slice(i + q.length));
}
function Combobox({
  label,
  hint,
  error,
  required = false,
  options = [],
  placeholder = "Buscar\u2026",
  value,
  defaultValue,
  onChange,
  disabled = false,
  clearable = true,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const opts = options.map(norm);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = controlled ? value : internal;
  const selected = opts.find((o) => o.value === current);
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [pos, setPos] = React.useState(null);
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const place = React.useCallback(() => {
    const c = rootRef.current && rootRef.current.querySelector(".hv-combo__control");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const gap = 6, maxH = 280;
    const below = window.innerHeight - r.bottom;
    const up = below < maxH && r.top > below;
    setPos({ left: r.left, width: r.width, top: up ? null : r.bottom + gap, bottom: up ? window.innerHeight - r.top + gap : null });
  }, []);
  const filtered = query ? opts.filter((o) => (o.label + " " + (o.description || "") + " " + (o.keywords || "")).toLowerCase().includes(query.toLowerCase())) : opts;
  React.useEffect(() => {
    if (open) {
      place();
      const t = setTimeout(() => setEnter(true), 10);
      return () => clearTimeout(t);
    }
    setEnter(false);
    setQuery("");
    setActive(0);
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
        setActive((a) => Math.min(filtered.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[active]) pick(filtered[active]);
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
  }, [open, active, filtered, place]);
  const pick = (o) => {
    if (!controlled) setInternal(o.value);
    onChange && onChange(o.value);
    setOpen(false);
  };
  const clear = (e) => {
    e.stopPropagation();
    if (!controlled) setInternal("");
    onChange && onChange("");
  };
  const popContent = pos && /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: popRef,
      className: "hv-combo__pop hv-combo__pop--fixed hv-scroll",
      id: `${fieldId}-list`,
      role: "listbox",
      "data-enter": enter,
      style: { position: "fixed", left: pos.left, width: pos.width, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto" }
    },
    filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-combo__empty" }, "Nenhum resultado para \u201C", query, "\u201D"),
    filtered.map((o, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        key: o.value,
        role: "option",
        "aria-selected": o.value === current,
        className: "hv-combo__opt",
        "data-selected": o.value === current,
        "data-active": i === active,
        onMouseEnter: () => setActive(i),
        onClick: () => pick(o)
      },
      /* @__PURE__ */ React.createElement("span", { className: "hv-combo__opt-main" }, /* @__PURE__ */ React.createElement("span", { className: "hv-combo__opt-label" }, /* @__PURE__ */ React.createElement(Highlight, { text: o.label, q: query })), o.description && /* @__PURE__ */ React.createElement("span", { className: "hv-combo__opt-desc" }, o.description)),
      /* @__PURE__ */ React.createElement("span", { className: "hv-combo__opt-check", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" })))
    ))
  );
  const control = /* @__PURE__ */ React.createElement("div", { className: ["hv-combo", className].filter(Boolean).join(" "), "data-open": open, ref: rootRef }, /* @__PURE__ */ React.createElement("div", { className: "hv-combo__control", "data-invalid": error ? "true" : void 0, onClick: () => {
    if (!disabled) {
      setOpen(true);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    }
  } }, /* @__PURE__ */ React.createElement("span", { className: "hv-combo__lead", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "11", r: "8" }), /* @__PURE__ */ React.createElement("path", { d: "m21 21-4.3-4.3" }))), /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: inputRef,
      id: fieldId,
      className: "hv-combo__input",
      disabled,
      placeholder: selected && !open ? "" : placeholder,
      value: open ? query : selected ? selected.label : "",
      onChange: (e) => {
        setQuery(e.target.value);
        setActive(0);
        if (!open) setOpen(true);
      },
      onFocus: () => setOpen(true),
      "aria-expanded": open,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      role: "combobox",
      "aria-controls": `${fieldId}-list`,
      autoComplete: "off",
      ...rest
    }
  ), clearable && selected && !open && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-combo__clear", "aria-label": "Limpar", onClick: clear }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" }))), /* @__PURE__ */ React.createElement("span", { className: "hv-combo__chev", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" })))), open && pos && (typeof document !== "undefined" ? createPortal(popContent, document.body) : popContent));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  Combobox
};
