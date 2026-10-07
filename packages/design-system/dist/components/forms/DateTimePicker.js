import React from "react";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
import "./_field.js";
import "./_datefield.js";
import { Button } from "../buttons/Button.js";
import { Calendar } from "./Calendar.js";
const DT_CSS = `
.hv-date__time { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-subtle); }
.hv-date__time-label { font-size: var(--text-sm); color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; }
.hv-date__time-label svg { width: 16px; height: 16px; }
.hv-date__time-inputs { display: flex; align-items: center; gap: var(--space-1); margin-left: auto; }
.hv-date__time-field { width: 46px; height: 34px; text-align: center; border: 1px solid var(--border-control); border-radius: var(--radius-sm);
  font: var(--text-md) var(--font-mono); color: var(--text-strong); background: var(--surface-card); }
/* Era petrol-400 cru enquanto Input e Select usam --border-brand: dois
   verdes diferentes para o mesmo estado, lado a lado no mesmo formulario. */
.hv-date__time-field:focus { outline: none; border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-date__time-colon { color: var(--text-muted); font-weight: 600; }
`;
function inject(id, css) {
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }
}
inject("hv-datetime-css", DT_CSS);
const p2 = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}` : "";
const fmtDT = (d) => d ? `${fmtDate(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}` : "";
const fmtISODT = (d) => d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}` : "";
const same = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const parseValue = (v, format) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (format === "iso") {
    const [dp2, tp2] = s.split("T");
    const [y2, m2, d2] = (dp2 || "").split("-").map(Number);
    let hh2 = 0, mm2 = 0;
    if (tp2) {
      const [H, M] = tp2.split(":").map(Number);
      hh2 = H || 0;
      mm2 = M || 0;
    }
    return y2 && m2 && d2 ? new Date(y2, m2 - 1, d2, hh2, mm2) : null;
  }
  const [dp, tp] = s.split(/\s+/);
  const [d, m, y] = (dp || "").split("/").map(Number);
  let hh = 0, mm = 0;
  if (tp) {
    const [H, M] = tp.split(":").map(Number);
    hh = H || 0;
    mm = M || 0;
  }
  return d && m && y ? new Date(y, m - 1, d, hh, mm) : null;
};
const serialize = (d, format) => !d ? format === "date" ? null : "" : format === "iso" ? fmtISODT(d) : format === "date" ? d : fmtDT(d);
let _dtp = 0;
const nextId = () => `hv-dtp-${++_dtp}`;
function DateTimePicker({
  timeLabel = "Hor\xE1rio",
  nowLabel = "Agora",
  applyLabel = "Aplicar",
  label,
  hint,
  error,
  required = false,
  placeholder = "dd/mm/aaaa --:--",
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
  const [internal, setInternal] = React.useState(parseValue(defaultValue, valueFormat));
  const selected = controlled ? parseValue(value, valueFormat) : internal;
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [draft, setDraft] = React.useState(selected || /* @__PURE__ */ new Date());
  const [hh, setHh] = React.useState((selected || /* @__PURE__ */ new Date()).getHours());
  const [mm, setMm] = React.useState((selected || /* @__PURE__ */ new Date()).getMinutes());
  const [view, setView] = React.useState(selected || /* @__PURE__ */ new Date());
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const place = React.useCallback(() => {
    const c = rootRef.current && rootRef.current.querySelector(".hv-date__control");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const gap = 6;
    const h = popRef.current && popRef.current.offsetHeight || 392;
    const below = window.innerHeight - r.bottom;
    const up = below < h + gap && r.top > below;
    const left = Math.min(r.left, window.innerWidth - 296 - 8);
    setPos({ left: Math.max(8, left), top: up ? null : r.bottom + gap, bottom: up ? window.innerHeight - r.top + gap : null });
  }, []);
  React.useEffect(() => {
    if (open) {
      const base = selected || /* @__PURE__ */ new Date();
      setDraft(base);
      setHh(base.getHours());
      setMm(base.getMinutes());
      setView(base);
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
  const commit = (d) => {
    if (!controlled) setInternal(d);
    onChange && onChange(serialize(d, valueFormat));
    setOpen(false);
  };
  const apply = () => {
    const d = new Date(draft.getFullYear(), draft.getMonth(), draft.getDate(), hh, mm);
    commit(d);
  };
  const clampHour = (raw) => setHh(Math.max(0, Math.min(23, parseInt(String(raw).replace(/\D/g, "") || "0", 10))));
  const clampMin = (raw) => setMm(Math.max(0, Math.min(59, parseInt(String(raw).replace(/\D/g, "") || "0", 10))));
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
        getCellProps: (d) => ({
          className: [same(d, today) ? "hv-date__cell--today" : "", same(d, draft) ? "hv-date__cell--selected" : ""].filter(Boolean).join(" "),
          onClick: () => setDraft(d)
        })
      }
    ),
    /* @__PURE__ */ React.createElement("div", { className: "hv-date__time" }, /* @__PURE__ */ React.createElement("span", { className: "hv-date__time-label" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "9" }), /* @__PURE__ */ React.createElement("path", { d: "M12 7v5l3 2" })), timeLabel), /* @__PURE__ */ React.createElement("span", { className: "hv-date__time-inputs" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "hv-date__time-field",
        inputMode: "numeric",
        maxLength: 2,
        "aria-label": "Hora",
        value: p2(hh),
        onChange: (e) => clampHour(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("span", { className: "hv-date__time-colon" }, ":"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "hv-date__time-field",
        inputMode: "numeric",
        maxLength: 2,
        "aria-label": "Minuto",
        value: p2(mm),
        onChange: (e) => clampMin(e.target.value)
      }
    ))),
    /* @__PURE__ */ React.createElement("div", { className: "hv-date__foot" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-date__quick", onClick: () => {
      const n = /* @__PURE__ */ new Date();
      setDraft(n);
      setHh(n.getHours());
      setMm(n.getMinutes());
      setView(n);
    } }, nowLabel), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", onClick: apply }, applyLabel))
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
    /* @__PURE__ */ React.createElement("span", { className: ["hv-date__txt", selected ? "" : "hv-date__txt--ph"].filter(Boolean).join(" ") }, selected ? fmtDT(selected) : placeholder)
  ), open && pos && (typeof document !== "undefined" ? createPortal(popContent, document.body) : popContent));
  if (!label && !hint && !error) return control;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), control, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  DateTimePicker
};
