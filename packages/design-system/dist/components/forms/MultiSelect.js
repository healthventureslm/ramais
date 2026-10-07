import React from "react";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "../_scroll.js";
import "./_field.js";
const CSS = `
.hv-ms { position: relative; font-family: var(--font-sans); }
.hv-ms__control {
  display: flex; align-items: center; gap: 6px; width: 100%; box-sizing: border-box; flex-wrap: wrap;
  background: var(--surface-card); border: var(--border-hair) solid var(--border-control);
  border-radius: var(--radius-md); min-height: 40px; padding: 5px 10px 5px var(--space-3); cursor: text;  /* @escala-livre: contrato de 13,0px de inicio de conteudo e 40px de altura entre Input, Select, Combobox, MultiSelect e DatePicker. Cada um chega la por padding diferente porque a estrutura interna e diferente; medido em tests/forms-playground.html. */
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-ms__control:hover:not([data-invalid]) { border-color: var(--border-control-hover); }
/* Mesmo vazio do Combobox: sem :focus-within, entrar por Tab com o popover
   fechado nao acendia anel nenhum. */
.hv-ms[data-open="true"] .hv-ms__control:not([data-invalid]),
.hv-ms__control:focus-within:not([data-invalid]) { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-ms__control[data-invalid="true"] { border-color: var(--danger-border); }
.hv-ms__control[data-invalid="true"]:focus-within { box-shadow: var(--shadow-focus-danger); }
.hv-ms__chip {
  display: inline-flex; align-items: center; gap: 5px; flex: none;
  background: var(--petrol-50); color: var(--brand-soft-fg); border: 1px solid var(--petrol-100);
  border-radius: var(--radius-sm); padding: 3px 5px 3px var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-medium);
  line-height: 1.2; max-width: 100%;
}
.hv-ms__chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-ms__chip-x { display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  border: none; background: transparent; color: var(--petrol-600); padding: 0; width: 16px; height: 16px;
  border-radius: var(--radius-xs); transition: var(--transition-colors); }
.hv-ms__chip-x:hover { background: var(--petrol-100); color: var(--brand-soft-fg); }
.hv-ms__chip-x:active { background: var(--petrol-200); transition-duration: 0s; }
.hv-ms__chip-x svg { width: 12px; height: 12px; stroke-width: 2.6; }
.hv-ms__input { flex: 1; min-width: 60px; border: none; outline: none; background: transparent;
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-strong); height: 26px; }
.hv-ms__input::placeholder { color: var(--text-subtle); }
.hv-ms__chev { flex: none; color: var(--text-muted); display: inline-flex; margin-left: auto;
  transition: transform var(--dur-normal) var(--ease-soft); }
.hv-ms__chev svg { width: 16px; height: 16px; display: block; }
.hv-ms[data-open="true"] .hv-ms__chev { transform: rotate(180deg); color: var(--petrol-600); }

.hv-ms__pop {
  position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 70;
  background: var(--surface-float); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 5px;
  max-height: 264px; overflow-y: auto; transform-origin: top center;
  opacity: 1; transform: translateY(0) scale(1);
  transition: transform var(--dur-fast) var(--ease-entrance);
}
.hv-ms__pop[data-enter="false"] { transform: translateY(-6px) scale(0.985); }
.hv-ms__pop--fixed { z-index: 200; }

.hv-ms__opt {
  display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box;
  padding: 9px 10px; border: none; background: transparent; cursor: pointer; text-align: left;  /* @escala-livre: a opcao alinha com o texto do controle que a abriu. */
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-body);
  border-radius: var(--radius-sm); transition: var(--transition-colors); line-height: 1.3;
}
.hv-ms__opt:hover, .hv-ms__opt[data-active="true"] { background: var(--state-brand-hover); color: var(--text-strong); }
.hv-ms__opt:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-ms__box { flex: none; width: 18px; height: 18px; border-radius: var(--radius-xs);
  border: 1.5px solid var(--border-control); background: var(--surface-card); display: inline-flex;
  align-items: center; justify-content: center; color: var(--action-primary-text); transition: var(--transition-colors); }
.hv-ms__opt[data-selected="true"] .hv-ms__box { background: var(--action-primary); border-color: var(--action-primary); }
.hv-ms__box svg { width: 12px; height: 12px; stroke-width: 3; opacity: 0; }
.hv-ms__opt[data-selected="true"] .hv-ms__box svg { opacity: 1; }
.hv-ms__opt-label { flex: 1; }
.hv-ms__empty { padding: var(--space-4) 10px; text-align: center; color: var(--text-muted); font-size: var(--text-sm); }

/* Dedo: 40px fica abaixo do --tap-min que o resto do DS respeita, e desde
   que os botoes passaram a crescer em ponteiro grosso o formulario ficava
   com campo de 40 e botao de 44 na mesma tela. Cresce so onde ha dedo. */
@media (pointer: coarse) {
  .hv-ms__control { min-height: var(--tap-min); }
}

/* A entrada do popover e geometria. Com menos movimento ele aparece ja no
   lugar, so por opacidade. */
@media (prefers-reduced-motion: reduce) {
  .hv-ms__pop { transition: opacity var(--dur-fast) linear; }
  .hv-ms__pop[data-enter="false"] { transform: none; }
  .hv-ms__chev svg { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-ms-css")) {
  const el = document.createElement("style");
  el.id = "hv-ms-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _ms = 0;
const nextId = () => `hv-ms-${++_ms}`;
const norm = (o) => typeof o === "string" ? { value: o, label: o } : o;
function MultiSelect({
  label,
  hint,
  error,
  required = false,
  options = [],
  placeholder = "Selecionar\u2026",
  value,
  defaultValue = [],
  onChange,
  disabled = false,
  maxTags,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const opts = options.map(norm);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue);
  const selected = controlled ? value : internal;
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [pos, setPos] = React.useState(null);
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const place = React.useCallback(() => {
    const c = rootRef.current && rootRef.current.querySelector(".hv-ms__control");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const gap = 6, maxH = 270;
    const below = window.innerHeight - r.bottom;
    const up = below < maxH && r.top > below;
    setPos({ left: r.left, width: r.width, top: up ? null : r.bottom + gap, bottom: up ? window.innerHeight - r.top + gap : null });
  }, []);
  const filtered = query ? opts.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : opts;
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
        if (filtered[active]) toggle(filtered[active].value);
      } else if (e.key === "Backspace" && query === "" && selected.length) {
        commit(selected.slice(0, -1));
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
  }, [open, active, filtered, selected, query, place]);
  const commit = (next) => {
    if (!controlled) setInternal(next);
    onChange && onChange(next);
  };
  const toggle = (v) => {
    if (selected.includes(v)) commit(selected.filter((x) => x !== v));
    else {
      if (maxTags && selected.length >= maxTags) return;
      commit([...selected, v]);
    }
  };
  const labelOf = (v) => (opts.find((o) => o.value === v) || {}).label || v;
  const popContent = pos && /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: popRef,
      className: "hv-ms__pop hv-ms__pop--fixed hv-scroll",
      role: "listbox",
      "aria-multiselectable": "true",
      "data-enter": enter,
      style: { position: "fixed", left: pos.left, width: pos.width, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto" }
    },
    filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-ms__empty" }, "Nenhum resultado", query ? ` para \u201C${query}\u201D` : ""),
    filtered.map((o, i) => {
      const on = selected.includes(o.value);
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          key: o.value,
          role: "option",
          "aria-selected": on,
          className: "hv-ms__opt",
          "data-selected": on,
          "data-active": i === active,
          onMouseEnter: () => setActive(i),
          onClick: () => toggle(o.value)
        },
        /* @__PURE__ */ React.createElement("span", { className: "hv-ms__box", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" }))),
        /* @__PURE__ */ React.createElement("span", { className: "hv-ms__opt-label" }, o.label)
      );
    })
  );
  const control = /* @__PURE__ */ React.createElement("div", { className: ["hv-ms", className].filter(Boolean).join(" "), "data-open": open, ref: rootRef }, /* @__PURE__ */ React.createElement("div", { className: "hv-ms__control", "data-invalid": error ? "true" : void 0, onClick: () => {
    if (!disabled) {
      setOpen(true);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    }
  } }, selected.map((v) => /* @__PURE__ */ React.createElement("span", { className: "hv-ms__chip", key: v }, /* @__PURE__ */ React.createElement("span", { className: "hv-ms__chip-label" }, labelOf(v)), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-ms__chip-x",
      "aria-label": `Remover ${labelOf(v)}`,
      onClick: (e) => {
        e.stopPropagation();
        toggle(v);
      }
    },
    /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" }))
  ))), /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: inputRef,
      id: fieldId,
      className: "hv-ms__input",
      disabled,
      placeholder: selected.length ? "" : placeholder,
      value: query,
      onChange: (e) => {
        setQuery(e.target.value);
        setActive(0);
        if (!open) setOpen(true);
      },
      onFocus: () => setOpen(true),
      role: "combobox",
      "aria-expanded": open,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      autoComplete: "off",
      ...rest
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "hv-ms__chev", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" })))), open && pos && (typeof document !== "undefined" ? createPortal(popContent, document.body) : popContent));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  MultiSelect
};
