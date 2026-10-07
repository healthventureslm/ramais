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
const LINE_CSS = `
.hv-chart__line { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.hv-chart__area { stroke: none; opacity: 0.12; }
.hv-chart__hit { fill: transparent; }
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
inject("hv-linechart-css", LINE_CSS);
const SERIES_COLORS = [
  "var(--petrol-500)",
  "var(--ink-500)",
  "var(--petrol-300)",
  "var(--amber-500)",
  "var(--emerald-500)",
  "var(--crimson-500)"
];
function LineChart({
  label,
  series,
  data,
  labels,
  height = 220,
  area = false,
  showGrid = true,
  showDots = false,
  yTicks = 4,
  min,
  max,
  legend,
  formatValue = formatarNumero,
  formatLabel = (l) => `${l}`,
  className = "",
  ...rest
}) {
  const wrapRef = React.useRef(null);
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
  const allSeries = React.useMemo(() => {
    if (Array.isArray(series)) return series;
    if (Array.isArray(data)) return [{ data }];
    return [];
  }, [series, data]);
  const resumoAcessivel = React.useMemo(() => {
    const vs = allSeries.flatMap((s) => s.data).filter(Number.isFinite);
    if (!vs.length) return "Gr\xE1fico de linha sem dados";
    const n2 = allSeries.length;
    return `Gr\xE1fico de linha, ${n2} ${n2 === 1 ? "s\xE9rie" : "s\xE9ries"}, ${vs.length} pontos, de ${Math.min(...vs)} a ${Math.max(...vs)}`;
  }, [allSeries]);
  const W = width || 640;
  const padL = 40, padR = 14, padT = 12, padB = 24;
  const innerW = Math.max(1, W - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const n = allSeries.reduce((m, s) => Math.max(m, s.data.length), 0);
  const flat = allSeries.flatMap((s) => s.data).filter((v) => Number.isFinite(v));
  let lo = min != null ? min : flat.length ? Math.min(...flat) : 0;
  let hi = max != null ? max : flat.length ? Math.max(...flat) : 1;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const xAt = (i) => padL + (n <= 1 ? innerW / 2 : i * innerW / (n - 1));
  const yAt = (v) => padT + innerH * (1 - (v - lo) / (hi - lo));
  const escala = degraus(lo, hi, yTicks);
  lo = escala.lo;
  hi = escala.hi;
  const ticks = escala.ticks;
  const showLegend = legend != null ? legend : allSeries.some((s) => s.name);
  const handleMove = (e) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = (x - padL) / innerW;
    const idx = Math.round(frac * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };
  const cls = ["hv-chart", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { ref: wrapRef, className: cls, ...rest }, /* @__PURE__ */ React.createElement(
    "svg",
    {
      className: "hv-chart__svg",
      viewBox: `0 0 ${W} ${height}`,
      width: W,
      height,
      onMouseMove: handleMove,
      onMouseLeave: () => setHover(-1),
      role: "img",
      "aria-label": label || resumoAcessivel
    },
    showGrid && ticks.map((v, i) => /* @__PURE__ */ React.createElement("g", { key: `g${i}` }, /* @__PURE__ */ React.createElement("line", { className: "hv-chart__grid", x1: padL, y1: yAt(v), x2: W - padR, y2: yAt(v) }), /* @__PURE__ */ React.createElement("text", { className: "hv-chart__axis-label", x: padL - 6, y: yAt(v) + 3, textAnchor: "end" }, formatValue(v)))),
    labels && labels.map((lab, i) => /* @__PURE__ */ React.createElement("text", { key: `x${i}`, className: "hv-chart__axis-label", x: xAt(i), y: height - 6, textAnchor: "middle" }, formatLabel(lab))),
    allSeries.map((s, si) => {
      const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
      const pts = s.data.map((v, i) => `${xAt(i)},${yAt(v)}`);
      const linePath = `M${pts.join(" L")}`;
      const areaPath = `M${xAt(0)},${yAt(lo)} L${pts.join(" L")} L${xAt(s.data.length - 1)},${yAt(lo)} Z`;
      return /* @__PURE__ */ React.createElement("g", { key: `s${si}` }, area && /* @__PURE__ */ React.createElement("path", { className: "hv-chart__area", d: areaPath, fill: color }), /* @__PURE__ */ React.createElement("path", { className: "hv-chart__line", d: linePath, stroke: color }), showDots && s.data.map((v, i) => /* @__PURE__ */ React.createElement("circle", { key: i, className: "hv-chart__dot", cx: xAt(i), cy: yAt(v), r: 3, fill: color })));
    }),
    hover >= 0 && /* @__PURE__ */ React.createElement("g", null, /* @__PURE__ */ React.createElement("line", { className: "hv-chart__guide", x1: xAt(hover), y1: padT, x2: xAt(hover), y2: padT + innerH }), allSeries.map((s, si) => {
      const v = s.data[hover];
      if (!Number.isFinite(v)) return null;
      const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
      return /* @__PURE__ */ React.createElement("circle", { key: si, className: "hv-chart__dot", cx: xAt(hover), cy: yAt(v), r: 4, fill: color });
    }))
  ), hover >= 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tooltip", style: { left: `${xAt(hover) / W * 100}%`, top: `${padT / height * 100}%` } }, /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tt-title" }, labels ? formatLabel(labels[hover]) : `#${hover + 1}`), allSeries.map((s, si) => {
    const v = s.data[hover];
    if (!Number.isFinite(v)) return null;
    const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
    return /* @__PURE__ */ React.createElement("div", { key: si, className: "hv-chart__tt-row" }, /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-swatch", style: { background: color } }), s.name && /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-name" }, s.name), /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-val" }, formatValue(v)));
  })), showLegend && /* @__PURE__ */ React.createElement("div", { className: "hv-chart__legend" }, allSeries.map((s, si) => /* @__PURE__ */ React.createElement("span", { key: si, className: "hv-chart__legend-item" }, /* @__PURE__ */ React.createElement("span", { className: "hv-chart__legend-swatch", style: { background: s.color || SERIES_COLORS[si % SERIES_COLORS.length] } }), s.name || `S\xE9rie ${si + 1}`))));
}
export {
  LineChart
};
