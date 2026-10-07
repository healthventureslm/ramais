import React from "react";
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
const DONUT_CSS = `
.hv-donut { position: relative; display: inline-flex; flex-direction: column; align-items: center; }
.hv-donut__seg { transition: opacity var(--dur-fast) var(--ease-standard); cursor: default; }
.hv-donut__seg--dim { opacity: 0.4; }
/* Mono, nao display. O valor central de um donut e dado clinico \u2014 numero que
   a pessoa compara, confere ou dita \u2014 e a Regra do mono manda mono. O StatCard
   foi reescrito por esse motivo exato, com a justificativa no codigo; o donut
   ficou de fora e continuou em display 700.

   O peso tambem desceu: 700 e o peso que o catalogo chama de "esforcado", e
   era numero cravado em vez de token. O eixo destes mesmos graficos ja estava
   em mono \u2014 o sistema conhecia a regra e aplicava num lugar so. */
.hv-donut__center-val { fill: var(--text-strong); font-family: var(--font-mono);
  font-weight: var(--weight-medium); letter-spacing: var(--tracking-snug); }
.hv-donut__center-lbl { fill: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: var(--tracking-wider); }
.hv-donut .hv-chart__legend { gap: var(--space-2) var(--space-3); justify-content: center; }
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
inject("hv-donutchart-css", DONUT_CSS);
const SERIES_COLORS = [
  "var(--petrol-500)",
  "var(--ink-500)",
  "var(--petrol-300)",
  "var(--amber-500)",
  "var(--emerald-500)",
  "var(--crimson-500)"
];
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function donutSegment(cx, cy, R, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, R, a0);
  const [x1, y1] = polar(cx, cy, R, a1);
  const [x2, y2] = polar(cx, cy, r, a1);
  const [x3, y3] = polar(cx, cy, r, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
}
function DonutChart({
  label,
  data = [],
  size = 180,
  thickness = 22,
  gap = 1.5,
  centerLabel,
  centerValue,
  legend = true,
  formatValue = (v) => `${v}`,
  className = "",
  ...rest
}) {
  const [hover, setHover] = React.useState(-1);
  const resumoAcessivel = React.useMemo(() => {
    const its = data.filter((d) => Number.isFinite(d && d.value));
    if (!its.length) return "Gr\xE1fico de rosca sem dados";
    const soma = its.reduce((s, d) => s + d.value, 0) || 1;
    const partes = its.map((d) => `${d.label}: ${Math.round(d.value / soma * 100)}%`).join(", ");
    return `Gr\xE1fico de rosca. ${partes}`;
  }, [data]);
  const total = data.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 2;
  const r = R - thickness;
  let acc = 0;
  const segs = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const a0 = acc * 360;
    acc += frac;
    const a1 = acc * 360;
    return { ...d, i, frac, a0, a1, color: d.color || SERIES_COLORS[i % SERIES_COLORS.length] };
  });
  const displayValue = centerValue != null ? centerValue : formatValue(total);
  const cls = ["hv-chart", "hv-donut", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { className: cls, style: { width: size }, ...rest }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", width: size, height: size }, onMouseLeave: () => setHover(-1) }, /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: "img", "aria-label": label || resumoAcessivel, style: { display: "block" } }, total === 0 && /* @__PURE__ */ React.createElement("circle", { cx, cy, r: (R + r) / 2, fill: "none", stroke: "var(--border-subtle)", strokeWidth: thickness }), segs.map((s) => {
    const pad = s.frac < 1 ? gap / 2 : 0;
    const a0 = s.a0 + pad;
    const a1 = Math.max(a0, s.a1 - pad);
    return /* @__PURE__ */ React.createElement(
      "path",
      {
        key: s.i,
        className: ["hv-donut__seg", hover !== -1 && hover !== s.i ? "hv-donut__seg--dim" : ""].filter(Boolean).join(" "),
        d: donutSegment(cx, cy, R, r, a0, a1),
        fill: s.color,
        onMouseEnter: () => setHover(s.i)
      }
    );
  }), /* @__PURE__ */ React.createElement(
    "text",
    {
      className: "hv-donut__center-val",
      x: cx,
      y: cy,
      textAnchor: "middle",
      dominantBaseline: "central",
      style: { fontSize: size * 0.18 }
    },
    displayValue
  ), centerLabel && /* @__PURE__ */ React.createElement("text", { className: "hv-donut__center-lbl", x: cx, y: cy + size * 0.16, textAnchor: "middle" }, centerLabel)), hover >= 0 && segs[hover] && (() => {
    const mid = (segs[hover].a0 + segs[hover].a1) / 2;
    const [tx, ty] = polar(cx, cy, (R + r) / 2, mid);
    return /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tooltip", style: { left: `${tx / size * 100}%`, top: `${ty / size * 100}%` } }, /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tt-title" }, segs[hover].label), /* @__PURE__ */ React.createElement("div", { className: "hv-chart__tt-row" }, /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-swatch", style: { background: segs[hover].color } }), /* @__PURE__ */ React.createElement("span", { className: "hv-chart__tt-val" }, formatValue(segs[hover].value), " \xB7 ", Math.round(segs[hover].frac * 100), "%")));
  })()), legend && /* @__PURE__ */ React.createElement("div", { className: "hv-chart__legend" }, segs.map((s) => /* @__PURE__ */ React.createElement("span", { key: s.i, className: "hv-chart__legend-item" }, /* @__PURE__ */ React.createElement("span", { className: "hv-chart__legend-swatch", style: { background: s.color } }), s.label))));
}
export {
  DonutChart
};
