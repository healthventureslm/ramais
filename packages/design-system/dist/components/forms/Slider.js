import React from "react";
const CSS = `
.hv-slider { font-family: var(--font-sans); width: 100%; }
.hv-slider__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.hv-slider__label { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-strong); }
.hv-slider__readout { display: inline-flex; align-items: center; gap: var(--space-2); }
.hv-slider__value { font: 600 var(--text-xl)/1 var(--font-mono); color: var(--text-strong); font-variant-numeric: tabular-nums; }
.hv-slider__suffix { font: var(--text-sm)/1 var(--font-mono); color: var(--text-muted); margin-left: -3px; }
.hv-slider__tag { font: var(--weight-semibold) var(--text-2xs)/1 var(--font-sans); letter-spacing: var(--tracking-wide);
  text-transform: uppercase; padding: 5px 10px; border-radius: var(--radius-pill); white-space: nowrap; }

.hv-slider__track-wrap { position: relative; height: 24px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
.hv-slider__rail { position: absolute; left: 0; right: 0; height: 8px; border-radius: var(--radius-pill);
  background: var(--surface-sunken); overflow: hidden; pointer-events: none; }
.hv-slider__rail--eva { background: linear-gradient(90deg,
  var(--emerald-500) 0%, var(--emerald-500) 22%, var(--amber-500) 46%,
  var(--coral-500) 70%, var(--crimson-500) 100%); overflow: visible; box-shadow: var(--shadow-inset); pointer-events: none; }
.hv-slider__fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--radius-pill);
  background: var(--action-primary); transition: width var(--dur-fast) var(--ease-standard), background-color var(--dur-normal) var(--ease-standard); }
.hv-slider__thumb { position: absolute; width: 22px; height: 22px; border-radius: 50%; background: var(--white); pointer-events: none;
  border: 3px solid var(--action-primary); box-shadow: var(--shadow-sm), 0 0 0 0 transparent; transform: translateX(-50%);
  transition: left var(--dur-fast) var(--ease-standard), border-color var(--dur-normal) var(--ease-standard), box-shadow var(--dur-fast); }
.hv-slider__track-wrap:hover .hv-slider__thumb { box-shadow: var(--shadow-md); }
.hv-slider__track-wrap:active .hv-slider__thumb { box-shadow: var(--shadow-md), var(--shadow-focus); }
.hv-slider input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0; z-index: 1; }
.hv-slider input:focus-visible ~ .hv-slider__thumb { box-shadow: var(--shadow-md), var(--shadow-focus); }
.hv-slider input:disabled { cursor: not-allowed; }
.hv-slider[data-disabled="true"] { opacity: var(--opacity-disabled); }

.hv-slider__ticks { display: flex; justify-content: space-between; margin-top: 9px; padding: 0 1px; }
.hv-slider__tick { font: var(--text-2xs)/1 var(--font-mono); color: var(--text-muted); }
.hv-slider__ticks--eva .hv-slider__tick { width: 9.09%; text-align: center; }
.hv-slider__ticks--eva .hv-slider__tick:first-child { text-align: left; }
.hv-slider__ticks--eva .hv-slider__tick:last-child { text-align: right; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-slider-css")) {
  const el = document.createElement("style");
  el.id = "hv-slider-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function evaBand(v) {
  if (v <= 0) return { color: "var(--emerald-500)", bg: "var(--emerald-100)", fg: "var(--emerald-700)", label: "Sem dor" };
  if (v <= 3) return { color: "var(--emerald-500)", bg: "var(--emerald-100)", fg: "var(--emerald-700)", label: "Leve" };
  if (v <= 6) return { color: "var(--amber-500)", bg: "var(--warning-bg)", fg: "var(--warning-fg)", label: "Moderada" };
  if (v <= 8) return { color: "var(--coral-600)", bg: "var(--danger-subtle)", fg: "var(--danger-fg)", label: "Intensa" };
  return { color: "var(--crimson-500)", bg: "var(--danger-bg)", fg: "var(--danger-fg)", label: "Insuport\xE1vel" };
}
function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  defaultValue,
  onChange,
  suffix = "",
  eva = false,
  showTicks = false,
  ticks,
  disabled = false,
  fallbackLabel = "Controle deslizante",
  id,
  className = "",
  ...rest
}) {
  const lo = min ?? 0;
  const hi = max ?? (eva ? 10 : 100);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue ?? lo);
  const v = controlled ? value : internal;
  const pct = Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const set = (nv) => {
    if (!controlled) setInternal(nv);
    onChange && onChange(nv);
  };
  const band = eva ? evaBand(v) : null;
  const fillColor = eva ? band.color : "var(--action-primary)";
  const evaTicks = eva ? Array.from({ length: 11 }, (_, i) => i) : null;
  const tickValues = ticks || (showTicks ? [lo, Math.round((lo + hi) / 2), hi] : null);
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-slider", className].filter(Boolean).join(" "), "data-disabled": disabled || void 0 }, (label || eva || suffix) && /* @__PURE__ */ React.createElement("div", { className: "hv-slider__top" }, label && /* @__PURE__ */ React.createElement("span", { className: "hv-slider__label" }, label), /* @__PURE__ */ React.createElement("span", { className: "hv-slider__readout" }, eva && /* @__PURE__ */ React.createElement("span", { className: "hv-slider__tag", style: { background: band.bg, color: band.fg } }, band.label), /* @__PURE__ */ React.createElement("span", { className: "hv-slider__value", style: eva ? { color: band.fg } : null }, v), (suffix || eva) && /* @__PURE__ */ React.createElement("span", { className: "hv-slider__suffix" }, eva ? "/10" : suffix))), /* @__PURE__ */ React.createElement("div", { className: "hv-slider__track-wrap" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "range",
      min: lo,
      max: hi,
      step,
      value: v,
      disabled,
      id,
      onChange: (e) => set(Number(e.target.value)),
      "aria-label": typeof label === "string" ? label : fallbackLabel,
      "aria-valuetext": eva ? `${v} de 10 \u2014 ${band.label}` : void 0,
      ...rest
    }
  ), /* @__PURE__ */ React.createElement("div", { className: ["hv-slider__rail", eva ? "hv-slider__rail--eva" : ""].filter(Boolean).join(" ") }, !eva && /* @__PURE__ */ React.createElement("div", { className: "hv-slider__fill", style: { width: `${pct}%`, background: fillColor } })), /* @__PURE__ */ React.createElement("div", { className: "hv-slider__thumb", style: { left: `${pct}%`, borderColor: fillColor } })), eva ? /* @__PURE__ */ React.createElement("div", { className: "hv-slider__ticks hv-slider__ticks--eva" }, evaTicks.map((t) => /* @__PURE__ */ React.createElement("span", { key: t, className: "hv-slider__tick" }, t))) : tickValues && /* @__PURE__ */ React.createElement("div", { className: "hv-slider__ticks" }, tickValues.map((t, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "hv-slider__tick" }, t))));
}
export {
  Slider
};
