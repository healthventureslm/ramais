import React from "react";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "./_field.js";
import "./_datefield.js";
import { Calendar } from "./Calendar.js";
const CSS = `
/* A casca (.hv-date, __pop, __foot, __quick) vem de _datefield.jsx. Aqui fica
   so o que existe porque este picker se digita. */
.hv-date__field {
  display: flex; align-items: center; gap: 2px; width: 100%; box-sizing: border-box;
  background: var(--surface-card); border: var(--border-hair) solid var(--border-control);
  border-radius: var(--radius-md); height: 40px; padding: 0 var(--space-1);
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-date__field:hover:not([data-disabled="true"]):not([data-invalid]) { border-color: var(--border-control-hover); }
.hv-date__field:focus-within:not([data-invalid]) { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-date__field[data-disabled="true"] { background: var(--surface-sunken); }
.hv-date__field[data-invalid="true"] { border-color: var(--danger-border); }
.hv-date__field[data-invalid="true"]:focus-within { box-shadow: var(--shadow-focus-danger); }

/* Digitos tabulares: sem isso o texto dan\xE7a para os lados enquanto a mascara
   insere as barras, e a data parece instavel debaixo do dedo. */
.hv-date__input {
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font: var(--text-md) var(--font-sans); font-variant-numeric: tabular-nums;
  color: var(--text-strong); padding: 0 var(--space-1); height: 100%;
}
.hv-date__input::placeholder { color: var(--text-subtle); }
.hv-date__input:disabled { color: var(--text-muted); cursor: not-allowed; }

.hv-date__toggle {
  flex: none; border: none; background: transparent; cursor: pointer; color: var(--text-subtle);
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; justify-content: center; transition: var(--transition-colors);
}
.hv-date__toggle:hover:not(:disabled) { background: var(--state-hover); color: var(--brand-soft-fg); }
.hv-date__toggle:active:not(:disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-date__toggle:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: -1px; }
.hv-date__toggle:disabled { cursor: not-allowed; }
.hv-date__toggle svg { width: 17px; height: 17px; }
.hv-date[data-open="true"] .hv-date__toggle { color: var(--brand-soft-fg); }

/* Atalhos relativos: a resposta mais curta para "voltar" alguns dias sem
   precisar saber a data. Rolam na horizontal para nao esticar o popover. */
.hv-date__presets { display: flex; gap: var(--space-1); overflow-x: auto; margin: var(--space-3) -14px -2px; padding: 10px 14px 2px;
  border-top: 1px solid var(--border-subtle); scrollbar-width: none; }
.hv-date__presets::-webkit-scrollbar { display: none; }
.hv-date__preset {
  flex: none; border: var(--border-hair) solid var(--border-control); background: var(--surface-card);
  cursor: pointer; font: 500 var(--text-sm) var(--font-sans); color: var(--text-body);
  padding: 5px 11px; border-radius: var(--radius-pill); transition: var(--transition-colors); white-space: nowrap;
}
.hv-date__preset:hover { background: var(--state-brand-hover); border-color: var(--border-brand); color: var(--brand-soft-fg); }
.hv-date__preset:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-date__preset:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: 1px; }

/* Dedo: 40px fica abaixo do --tap-min que o resto do DS respeita, e desde
   que os botoes passaram a crescer em ponteiro grosso o formulario ficava
   com campo de 40 e botao de 44 na mesma tela. Cresce so onde ha dedo. */
@media (pointer: coarse) {
  .hv-date__field { height: var(--tap-min); }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-dateinput-css")) {
  const el = document.createElement("style");
  el.id = "hv-dateinput-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const p2 = (n) => String(n).padStart(2, "0");
const fmt = (d) => d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}` : "";
const fmtISO = (d) => d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : "";
const same = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const parseValue = (v, format) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (format === "iso") {
    const [y2, m2, d2] = s.split("-").map(Number);
    return y2 && m2 && d2 ? new Date(y2, m2 - 1, d2) : null;
  }
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
};
const serialize = (d, format) => !d ? format === "date" ? null : "" : format === "iso" ? fmtISO(d) : format === "date" ? d : fmt(d);
const mascarar = (s) => {
  const d = String(s).replace(/[^0-9]/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter((p) => p.length).join("/");
};
const anoCompleto = (yy) => {
  const atual = (/* @__PURE__ */ new Date()).getFullYear();
  const cheio = Math.floor(atual / 100) * 100 + yy;
  return cheio > atual + 10 ? cheio - 100 : cheio;
};
const completar = (texto, referencia) => {
  const d = String(texto).replace(/[^0-9]/g, "");
  if (!d.length) return null;
  const ref = referencia instanceof Date ? referencia : /* @__PURE__ */ new Date();
  let dia, mes, ano;
  if (d.length <= 2) {
    dia = +d;
    mes = ref.getMonth() + 1;
    ano = ref.getFullYear();
  } else if (d.length <= 4) {
    dia = +d.slice(0, 2);
    mes = +d.slice(2);
    ano = ref.getFullYear();
  } else if (d.length <= 6) {
    dia = +d.slice(0, 2);
    mes = +d.slice(2, 4);
    ano = anoCompleto(+d.slice(4));
  } else {
    dia = +d.slice(0, 2);
    mes = +d.slice(2, 4);
    ano = +d.slice(4);
  }
  if (!dia || !mes || !ano || mes > 12) return null;
  const data = new Date(ano, mes - 1, dia);
  if (data.getDate() !== dia || data.getMonth() !== mes - 1 || data.getFullYear() !== ano) return null;
  return data;
};
let _dp = 0;
const nextId = () => `hv-dp-${++_dp}`;
function DatePicker({
  todayLabel = "Hoje",
  clearLabel = "Limpar",
  calendarLabel = "Abrir calend\xE1rio",
  presets,
  label,
  hint,
  error,
  required = false,
  placeholder = "dd/mm/aaaa",
  value,
  defaultValue,
  onChange,
  min,
  max,
  valueFormat = "br",
  disabled = false,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(parseValue(defaultValue, valueFormat));
  const selected = controlled ? parseValue(value, valueFormat) : internal;
  const minD = parseValue(min, valueFormat), maxD = parseValue(max, valueFormat);
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [view, setView] = React.useState(selected || /* @__PURE__ */ new Date());
  const [texto, setTexto] = React.useState(fmt(selected));
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const digitando = React.useRef(false);
  React.useEffect(() => {
    if (!digitando.current) setTexto(fmt(selected));
  }, [selected && selected.getTime()]);
  const place = React.useCallback(() => {
    const c = rootRef.current && rootRef.current.querySelector(".hv-date__field");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const gap = 6;
    const h = popRef.current && popRef.current.offsetHeight || 336;
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const up = below < h + gap && above > below;
    const left = Math.min(r.left, window.innerWidth - 296 - 8);
    setPos({ left: Math.max(8, left), top: up ? null : r.bottom + gap, bottom: up ? window.innerHeight - r.top + gap : null });
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
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place]);
  const inRange = (d) => (!minD || d >= minD) && (!maxD || d <= maxD);
  const pick = (d, { fechar = true } = {}) => {
    if (!controlled) setInternal(d);
    setTexto(fmt(d));
    if (d) setView(d);
    onChange && onChange(serialize(d, valueFormat));
    if (fechar) setOpen(false);
  };
  const onInput = (e) => {
    const t = mascarar(e.target.value);
    setTexto(t);
    const d = completar(t, view);
    if (d) {
      setView(d);
      if (t.replace(/[^0-9]/g, "").length === 8 && inRange(d)) pick(d, { fechar: false });
    }
  };
  const confirmar = () => {
    digitando.current = false;
    if (!texto.trim()) {
      if (selected) pick(null, { fechar: false });
      return true;
    }
    const d = completar(texto, view);
    if (d && inRange(d)) {
      pick(d, { fechar: false });
      return true;
    }
    setTexto(fmt(selected));
    return false;
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (confirmar()) setOpen(false);
      return;
    }
    if (e.key === "Escape") {
      setTexto(fmt(selected));
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown" && open && popRef.current) {
      const alvo = popRef.current.querySelector('[data-foco="true"]');
      if (alvo) {
        e.preventDefault();
        alvo.focus();
      }
    }
  };
  const today = /* @__PURE__ */ new Date();
  const popContent = pos && /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: popRef,
      className: "hv-date__pop",
      role: "dialog",
      "data-enter": enter,
      style: { left: pos.left, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto" }
    },
    /* @__PURE__ */ React.createElement(
      Calendar,
      {
        month: view,
        onMonthChange: setView,
        min: minD,
        max: maxD,
        getCellProps: (d) => ({
          className: [same(d, today) ? "hv-date__cell--today" : "", same(d, selected) ? "hv-date__cell--selected" : ""].filter(Boolean).join(" "),
          disabled: !inRange(d),
          onClick: () => {
            pick(d);
            inputRef.current && inputRef.current.focus();
          }
        })
      }
    ),
    presets && presets.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-date__presets" }, presets.map((p, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: p.key || p.label || i,
        type: "button",
        className: "hv-date__preset",
        onClick: () => {
          const alvo = p.date instanceof Date ? p.date : new Date(today.getFullYear(), today.getMonth(), today.getDate() + (p.offset || 0));
          if (inRange(alvo)) pick(alvo);
        }
      },
      p.label
    ))),
    /* @__PURE__ */ React.createElement("div", { className: "hv-date__foot" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-date__quick", onClick: () => {
      const t = /* @__PURE__ */ new Date();
      if (inRange(t)) pick(t);
    } }, todayLabel), selected && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-date__quick", onClick: () => pick(null) }, clearLabel))
  );
  const control = /* @__PURE__ */ React.createElement("div", { className: ["hv-date", className].filter(Boolean).join(" "), "data-open": open, ref: rootRef }, /* @__PURE__ */ React.createElement("div", { className: "hv-date__field", "data-disabled": disabled || void 0, "data-invalid": error ? "true" : void 0 }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-date__toggle",
      disabled,
      "aria-label": calendarLabel,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: () => {
        setOpen((o) => !o);
        inputRef.current && inputRef.current.focus();
      }
    },
    /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M3 10h18M8 2v4M16 2v4" }))
  ), /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: inputRef,
      id: fieldId,
      className: "hv-date__input",
      type: "text",
      inputMode: "numeric",
      autoComplete: "off",
      placeholder,
      value: texto,
      disabled,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      onChange: onInput,
      onKeyDown,
      onFocus: () => {
        digitando.current = true;
        setOpen(true);
      },
      onBlur: (e) => {
        if (popRef.current && popRef.current.contains(e.relatedTarget)) return;
        confirmar();
      },
      ...rest
    }
  )), open && pos && (typeof document !== "undefined" ? createPortal(popContent, document.body) : popContent));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  DatePicker
};
