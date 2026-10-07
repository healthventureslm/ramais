import React from "react";
import { degraus, formatarNumero } from "./scale.js";
const BASE_CSS = `
.hv-chart { position: relative; width: 100%; font-family: var(--font-sans); color: var(--text-body); }
.hv-chart__svg { display: block; width: 100%; overflow: visible; }
.hv-chart__grid { stroke: var(--border-subtle); stroke-width: 1; }
.hv-chart__axis-label { fill: var(--text-muted); font-size: 11px; font-family: var(--font-mono); }
.hv-chart__guide { stroke: var(--border-strong); stroke-width: 1; stroke-dasharray: 3 3; }
.hv-chart__dot { stroke: var(--surface-card); stroke-width: 2; }
.hv-chart__tooltip {
  position: absolute; z-index: 20; pointer-events: none;
  transform: translate(-50%, calc(-100% - 12px));
  background: var(--surface-float); border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  padding: var(--space-2) var(--space-3); min-width: 92px; font-size: var(--text-xs); white-space: nowrap;
}
.hv-chart__tt-title { font-weight: 600; color: var(--text-strong); margin-bottom: var(--space-1); font-family: var(--font-mono); }
.hv-chart__tt-row { display: flex; align-items: center; gap: 6px; line-height: 1.5; }
.hv-chart__tt-swatch { width: 8px; height: 8px; border-radius: 2px; flex: none; }
.hv-chart__tt-name { color: var(--text-muted); }
.hv-chart__tt-val { margin-left: auto; font-weight: 600; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.hv-chart__legend { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-3); }
.hv-chart__legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--text-body); }
.hv-chart__legend-swatch { width: 10px; height: 10px; border-radius: 3px; flex: none; }
`;
const BAR_CSS = `
.hv-bar { transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-bar--dim { opacity: 0.4; }
`;
function inject(id, css) {
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }
}
inject("hv-chart-css", BASE_CSS);
inject("hv-barchart-css", BAR_CSS);
const SERIES_COLORS = [
  "var(--petrol-500)",
  "var(--ink-500)",
  "var(--petrol-300)",
  "var(--amber-500)",
  "var(--emerald-500)",
  "var(--crimson-500)"
];
function BarChart({
  label,
  data = [],
  height = 220,
  max,
  showGrid = true,
  yTicks = 4,
  barColor = "var(--petrol-500)",
  formatValue = formatarNumero,
  className = "",
  ...rest
}) {
  const wrapRef = React.useRef(null);
  const resumoAcessivel = React.useMemo(() => {
    const vs = data.map((d) => Number(d && d.value)).filter(Number.isFinite);
    if (!vs.length) return "Gr\xE1fico de barras sem dados";
    const n2 = vs.length;
    return `Gr\xE1fico de barras, ${n2} ${n2 === 1 ? "barra" : "barras"}, de ${formatValue(Math.min(...vs))} a ${formatValue(Math.max(...vs))}`;
  }, [data, formatValue]);
  const [width, setWidth] = React.useState(0);
  const [hover, setHover] = React.useState(-1);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = width || 640;
  const padL = 40, padR = 14, padT = 12, padB = 26;
  const innerW = Math.max(1, W - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const n = data.length;
  const values = data.map((d) => d.value).filter((v) => Number.isFinite(v));
  let hi = max != null ? max : values.length ? Math.max(...values) : 1;
  let lo = 0;
  const slot = n > 0 ? innerW / n : innerW;
  const barW = slot * 0.62;
  const yAt = (v) => padT + innerH * (1 - (v - lo) / (hi - lo || 1));
  const xCenter = (i) => padL + slot * i + slot / 2;
  const ticks = [];
  {
    const escala = degraus(lo, hi, yTicks);
    lo = escala.lo;
    hi = escala.hi;
    ticks.push(...escala.ticks);
  }
  const cls = ["hv-chart", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { ref: wrapRef, className: cls, ...rest }, /* @__PURE__ */ React.createElement(
    "svg",
    {
      className: "hv-chart__svg",
      viewBox: `0 0 ${W} ${height}`,
      width: W,
      height,
      onMouseLeave: () => setHover(-1),
      role: "img",
      "aria-label": label || resumoAcessivel
    },
    showGrid && ticks.map((v, i) => /* @__PURE__ */ React.createElement("g", { key: `g${i}` }, /* @__PURE__ */ React.createElement("line", { className: "hv-chart__grid", x1: padL, y1: yAt(v), x2: W - padR, y2: yAt(v) }), /* @__PURE__ */ React.createElement("text", { className: "hv-chart__axis-label", x: padL - 6, y: yAt(v) + 3, textAnchor: "end" }, formatValue(v)))),
    data.map((d, i) => {
      const color = d.color || barColor;
      const top = yAt(d.value);
      const h = Math.max(0, padT + innerH - top);
      return /* @__PURE__ */ React.createElement("g", { key: i, onMouseEnter: () => setHover(i) }, /* @__PURE__ */ React.createElement(
        "rect",
        {
          className: ["hv-bar", hover !== -1 && hover !== i ? "hv-bar--dim" : ""].filter(Boolean).join(" "),
          x: xCenter(i) - barW / 2,
          y: top,
          width: barW,
          height: h,
          rx: 4,
          fill: color
        }
      ), /* @__PURE__ */ React.createElement("text", { className: "hv-chart__axis-label", x: xCenter(i), y: height - 8, textAnchor: "middle" }, d.label), /* @__PURE__ */ React.createElement("rect", { x: padL + slot * i, y: padT, width: slot, height: innerH, fill: "transparent", onMouseEnter: () => setHover(i) }));
    })
  ), hover >= 0 && data[hover] && /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tooltip", style: { left: `${xCenter(hover) / W * 100}%`, top: `${yAt(data[hover].value) / height * 100}%` } }, /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tt-title" }, data[hover].label), /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tt-row" }, /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-swatch", style: { background: data[hover].color || barColor } }), /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-val" }, formatValue(data[hover].value)))));
}
export {
  BarChart
};
