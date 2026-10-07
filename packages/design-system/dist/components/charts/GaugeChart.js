import React from "react";
import { formatarNumero } from "./scale.js";
const GAUGE_CSS = `
.hv-gauge { position: relative; display: inline-flex; flex-direction: column; align-items: center; font-family: var(--font-sans); }
.hv-gauge__track { fill: var(--border-subtle); }
.hv-gauge__zone { transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-gauge__zone--dim { opacity: 0.4; }
.hv-gauge__marker { stroke: var(--text-strong); stroke-width: 2.5; stroke-linecap: round; }
.hv-gauge__val { fill: var(--text-strong); font-family: var(--font-display); font-weight: 700; }
.hv-gauge__lbl { fill: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: var(--tracking-wider); }
.hv-gauge__tooltip {
  position: absolute; z-index: 20; pointer-events: none;
  transform: translate(-50%, calc(-100% - 8px));
  background: var(--surface-float); border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  padding: var(--space-1) var(--space-2); font-size: var(--text-xs); white-space: nowrap; color: var(--text-strong); font-weight: 600;
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-gaugechart-css")) {
  const el = document.createElement("style");
  el.id = "hv-gaugechart-css";
  el.textContent = GAUGE_CSS;
  document.head.appendChild(el);
}
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function gaugePoint(cx, cy, radius, f) {
  return polar(cx, cy, radius, 270 + 180 * f);
}
function gaugeSegment(cx, cy, R, r, f0, f1) {
  const d0 = 270 + 180 * f0, d1 = 270 + 180 * f1;
  const [x0, y0] = polar(cx, cy, R, d0);
  const [x1, y1] = polar(cx, cy, R, d1);
  const [x2, y2] = polar(cx, cy, r, d1);
  const [x3, y3] = polar(cx, cy, r, d0);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
}
function GaugeChart({
  ariaLabel,
  value = 0,
  min = 0,
  max = 100,
  size = 180,
  thickness = 18,
  color = "var(--petrol-500)",
  segments,
  label,
  formatValue = formatarNumero,
  className = "",
  ...rest
}) {
  const [hover, setHover] = React.useState(-1);
  const cx = size / 2;
  const cy = size * 0.52;
  const R = size / 2 - 2;
  const r = R - thickness;
  const clamp = (f) => Math.max(0, Math.min(1, f));
  const frac = clamp((value - min) / (max - min || 1));
  const cls = ["hv-gauge", className].filter(Boolean).join(" ");
  const viewH = size * 0.62;
  const zones = segments ? segments.map((s, i) => {
    const f0 = clamp(((i === 0 ? min : segments[i - 1].upTo) - min) / (max - min || 1));
    const f1 = clamp((s.upTo - min) / (max - min || 1));
    return { ...s, i, f0, f1 };
  }) : null;
  const resumoAcessivel = React.useMemo(() => {
    const nome = `Medidor${label ? " de " + label : ""}`;
    if (min === 0) {
      return `${nome}: ${formatValue(value)} de ${formatValue(max)}`;
    }
    return `${nome}: ${formatValue(value)}, na faixa de ${formatValue(min)} a ${formatValue(max)}`;
  }, [value, min, max, label, formatValue]);
  return /* @__PURE__ */ React.createElement("div", { className: cls, style: { width: size }, ...rest }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", width: size, height: viewH }, onMouseLeave: () => setHover(-1) }, /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${size} ${viewH}`, width: size, height: viewH, role: "img", "aria-label": ariaLabel || resumoAcessivel, style: { display: "block" } }, /* @__PURE__ */ React.createElement("path", { className: "hv-gauge__track", d: gaugeSegment(cx, cy, R, r, 0, 1) }), zones ? zones.map((z) => /* @__PURE__ */ React.createElement(
    "path",
    {
      key: z.i,
      className: ["hv-gauge__zone", hover !== -1 && hover !== z.i ? "hv-gauge__zone--dim" : ""].filter(Boolean).join(" "),
      d: gaugeSegment(cx, cy, R, r, z.f0, z.f1),
      fill: z.color,
      onMouseEnter: () => setHover(z.i)
    }
  )) : frac > 0 && /* @__PURE__ */ React.createElement("path", { className: "hv-gauge__zone", d: gaugeSegment(cx, cy, R, r, 0, frac), fill: color }), (() => {
    const [mx0, my0] = gaugePoint(cx, cy, r - 2, frac);
    const [mx1, my1] = gaugePoint(cx, cy, R + 2, frac);
    return /* @__PURE__ */ React.createElement("line", { className: "hv-gauge__marker", x1: mx0, y1: my0, x2: mx1, y2: my1 });
  })(), /* @__PURE__ */ React.createElement("text", { className: "hv-gauge__val", x: cx, y: cy - 4, textAnchor: "middle", style: { fontSize: size * 0.2 } }, formatValue(value)), label && /* @__PURE__ */ React.createElement("text", { className: "hv-gauge__lbl", x: cx, y: cy + 16, textAnchor: "middle" }, label)), hover >= 0 && zones && zones[hover] && zones[hover].label && (() => {
    const mid = (zones[hover].f0 + zones[hover].f1) / 2;
    const [tx, ty] = gaugePoint(cx, cy, (R + r) / 2, mid);
    return /* @__PURE__ */ React.createElement("div", { className: "hv-gauge__tooltip", style: { left: `${tx / size * 100}%`, top: `${ty / viewH * 100}%` } }, zones[hover].label);
  })()));
}
export {
  GaugeChart
};
