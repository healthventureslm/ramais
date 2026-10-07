import React from "react";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "./_field.js";
import "./_datefield.js";
import { Button } from "../buttons/Button.js";
import { Calendar } from "./Calendar.js";
const RANGE_CSS = `
.hv-daterange__pop { width: 476px; }
.hv-daterange__layout { display: flex; gap: var(--space-3); }
.hv-daterange__presets { flex: none; width: 132px; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid var(--border-subtle); padding-right: var(--space-3); }
.hv-daterange__preset { text-align: left; border: none; background: transparent; cursor: pointer; font: 500 var(--text-sm) var(--font-sans);
  color: var(--text-body); padding: 7px 9px; border-radius: var(--radius-sm); transition: var(--transition-colors); }
.hv-daterange__preset:hover { background: var(--state-brand-hover); color: var(--petrol-700); }
.hv-daterange__preset:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-daterange__preset--active { background: var(--petrol-100); color: var(--petrol-700); font-weight: var(--weight-semibold); }
.hv-daterange__cal { flex: 1; min-width: 0; }
.hv-date__cell--inrange { background: var(--petrol-50); color: var(--brand-soft-fg); border-radius: 0; }
.hv-date__cell--start, .hv-date__cell--end { background: var(--action-primary); color: var(--action-primary-text); font-weight: 600; }
.hv-date__cell--start { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.hv-date__cell--end { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.hv-date__cell--start.hv-date__cell--end { border-radius: var(--radius-sm); }
.hv-date__cell--start:hover, .hv-date__cell--end:hover { background: var(--action-primary-hover); color: var(--action-primary-text); }
/* Um degrau mais fundo na MESMA rampa da acao primaria: as pontas do intervalo
   sao o alvo de reajuste mais apertado do calendario, e no toque o press e o
   unico sinal de que o dedo pegou o dia certo. */
.hv-date__cell--start:active, .hv-date__cell--end:active {
  background: var(--action-primary-press); color: var(--action-primary-text); transition-duration: 0s;
}
`;
function inject(id, css) {
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }
}
inject("hv-daterange-css", RANGE_CSS);
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
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};
let _drp = 0;
const nextId = () => `hv-drp-${++_drp}`;
const PRESETS = [
  { key: "hoje", label: "Hoje", range: () => {
    const t = startOfDay(/* @__PURE__ */ new Date());
    return [t, t];
  } },
  { key: "7d", label: "\xDAltimos 7 dias", range: () => {
    const t = startOfDay(/* @__PURE__ */ new Date());
    return [addDays(t, -6), t];
  } },
  { key: "30d", label: "\xDAltimos 30 dias", range: () => {
    const t = startOfDay(/* @__PURE__ */ new Date());
    return [addDays(t, -29), t];
  } },
  { key: "90d", label: "\xDAltimos 90 dias", range: () => {
    const t = startOfDay(/* @__PURE__ */ new Date());
    return [addDays(t, -89), t];
  } },
  { key: "mes", label: "Este m\xEAs", range: () => {
    const t = startOfDay(/* @__PURE__ */ new Date());
    return [new Date(t.getFullYear(), t.getMonth(), 1), t];
  } }
];
function DateRangePicker({
  clearLabel = "Limpar",
  applyLabel = "Aplicar",
  label,
  hint,
  error,
  required = false,
  placeholder = "dd/mm/aaaa \u2013 dd/mm/aaaa",
  value,
  defaultValue,
  onChange,
  valueFormat = "br",
  disabled = false,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const controlled = value !== void 0;
  const norm = (v) => ({ start: parseValue(v && v.start, valueFormat), end: parseValue(v && v.end, valueFormat) });
  const [internal, setInternal] = React.useState(norm(defaultValue));
  const committed = controlled ? norm(value) : internal;
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [start, setStart] = React.useState(committed.start);
  const [end, setEnd] = React.useState(committed.end);
  const [hover, setHover] = React.useState(null);
  const [view, setView] = React.useState(committed.start || /* @__PURE__ */ new Date());
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const W = 476;
  const place = React.useCallback(() => {
    const c = rootRef.current && rootRef.current.querySelector(".hv-date__control");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const gap = 6;
    const h = popRef.current && popRef.current.offsetHeight || 360;
    const below = window.innerHeight - r.bottom;
    const up = below < h + gap && r.top > below;
    const left = Math.min(r.left, window.innerWidth - W - 8);
    setPos({ left: Math.max(8, left), top: up ? null : r.bottom + gap, bottom: up ? window.innerHeight - r.top + gap : null });
  }, []);
  React.useEffect(() => {
    if (open) {
      setStart(committed.start);
      setEnd(committed.end);
      setHover(null);
      setView(committed.start || /* @__PURE__ */ new Date());
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
  }, [open, place]);
  const pickDay = (d) => {
    if (!start || start && end) {
      setStart(d);
      setEnd(null);
      setHover(null);
      return;
    }
    if (d >= start) setEnd(d);
    else {
      setEnd(start);
      setStart(d);
    }
  };
  const applyPreset = (preset) => {
    const [s, e] = preset.range();
    setStart(s);
    setEnd(e);
    setView(s);
  };
  const commit = (s, e) => {
    const next = { start: s, end: e };
    if (!controlled) setInternal(next);
    onChange && onChange({ start: serialize(s, valueFormat), end: serialize(e, valueFormat) });
    setOpen(false);
  };
  const apply = () => commit(start, end);
  const rangeEnd = end || (start && hover && hover >= start ? hover : null);
  const inRange = (d) => start && rangeEnd && d > start && d < rangeEnd;
  const activePreset = PRESETS.find((p) => {
    const [s, e] = p.range();
    return same(s, start) && same(e, end);
  });
  const today = /* @__PURE__ */ new Date();
  const display = committed.start ? `${fmt(committed.start)} \u2013 ${committed.end ? fmt(committed.end) : "\u2026"}` : placeholder;
  const popContent = pos && /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: popRef,
      className: "hv-date__pop hv-daterange__pop",
      role: "dialog",
      "data-enter": enter,
      style: { left: pos.left, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto" }
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-daterange__layout" }, /* @__PURE__ */ React.createElement("div", { className: "hv-daterange__presets" }, PRESETS.map((p) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: p.key,
        type: "button",
        className: ["hv-daterange__preset", activePreset && activePreset.key === p.key ? "hv-daterange__preset--active" : ""].filter(Boolean).join(" "),
        onClick: () => applyPreset(p)
      },
      p.label
    ))), /* @__PURE__ */ React.createElement("div", { className: "hv-daterange__cal" }, /* @__PURE__ */ React.createElement(
      Calendar,
      {
        month: view,
        onMonthChange: setView,
        getCellProps: (d) => {
          const isStart = same(d, start), isEnd = same(d, end) || !end && same(d, rangeEnd);
          return {
            className: [
              same(d, today) ? "hv-date__cell--today" : "",
              inRange(d) ? "hv-date__cell--inrange" : "",
              isStart ? "hv-date__cell--start" : "",
              isEnd ? "hv-date__cell--end" : ""
            ].filter(Boolean).join(" "),
            onClick: () => pickDay(d),
            onMouseEnter: () => setHover(d)
          };
        }
      }
    ))),
    /* @__PURE__ */ React.createElement("div", { className: "hv-date__foot" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-date__quick", onClick: () => {
      setStart(null);
      setEnd(null);
      setHover(null);
    } }, clearLabel), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", disabled: !start || !end, onClick: apply }, applyLabel))
  );
  const control = /* @__PURE__ */ React.createElement("div", { className: ["hv-date", className].filter(Boolean).join(" "), "data-open": open, ref: rootRef }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      id: fieldId,
      className: "hv-date__control",
      disabled,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      "data-invalid": error ? "true" : void 0,
      onClick: () => setOpen((o) => !o),
      ...rest
    },
    /* @__PURE__ */ React.createElement("span", { className: "hv-date__lead", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M3 10h18M8 2v4M16 2v4" }))),
    /* @__PURE__ */ React.createElement("span", { className: ["hv-date__txt", committed.start ? "" : "hv-date__txt--ph"].filter(Boolean).join(" ") }, display)
  ), open && pos && (typeof document !== "undefined" ? createPortal(popContent, document.body) : popContent));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  DateRangePicker
};
