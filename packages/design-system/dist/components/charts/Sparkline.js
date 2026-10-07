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
const SPARK_CSS = `
.hv-spark { display: inline-block; width: 100%; vertical-align: middle; }
.hv-spark__line { fill: none; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.hv-spark__area { stroke: none; opacity: 0.14; }
.hv-spark__tooltip {
  position: absolute; z-index: 20; pointer-events: none;
  transform: translate(-50%, calc(-100% - 10px));
  background: var(--surface-float); border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  padding: var(--space-1) var(--space-2); font-size: var(--text-xs); white-space: nowrap;
  font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text-strong);
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
inject("hv-chart-css", BASE_CSS);
inject("hv-sparkline-css", SPARK_CSS);
function Sparkline({
  label,
  data = [],
  height = 36,
  color = "var(--petrol-500)",
  area = false,
  showDot = true,
  min,
  max,
  interactive = true,
  formatValue = (v) => `${v}`,
  className = "",
  ...rest
}) {
  const wrapRef = React.useRef(null);
  const resumoAcessivel = React.useMemo(() => {
    const vs = data.filter(Number.isFinite);
    if (!vs.length) return "Minigr\xE1fico sem dados";
    const dir = vs[vs.length - 1] > vs[0] ? "subindo" : vs[vs.length - 1] < vs[0] ? "descendo" : "est\xE1vel";
    return `Minigr\xE1fico de tend\xEAncia, ${vs.length} pontos, ${dir}, de ${formatValue(Math.min(...vs))} a ${formatValue(Math.max(...vs))}`;
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
  const W = width || 160;
  const pad = 4;
  const innerW = Math.max(1, W - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const n = data.length;
  const vals = data.filter((v) => Number.isFinite(v));
  let lo = min != null ? min : vals.length ? Math.min(...vals) : 0;
  let hi = max != null ? max : vals.length ? Math.max(...vals) : 1;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const xAt = (i) => pad + (n <= 1 ? innerW / 2 : i * innerW / (n - 1));
  const yAt = (v) => pad + innerH * (1 - (v - lo) / (hi - lo));
  const pts = data.map((v, i) => `${xAt(i)},${yAt(v)}`);
  const linePath = n ? `M${pts.join(" L")}` : "";
  const areaPath = n ? `M${xAt(0)},${yAt(lo)} L${pts.join(" L")} L${xAt(n - 1)},${yAt(lo)} Z` : "";
  const handleMove = (e) => {
    if (!interactive || n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left - pad) / innerW;
    setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  };
  const cls = ["hv-chart", "hv-spark", className].filter(Boolean).join(" ");
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
    area && areaPath && /* @__PURE__ */ React.createElement("path", { className: "hv-spark__area", d: areaPath, fill: color }),
    linePath && /* @__PURE__ */ React.createElement("path", { className: "hv-spark__line", d: linePath, stroke: color }),
    showDot && n > 0 && hover < 0 && /* @__PURE__ */ React.createElement("circle", { className: "hv-chart__dot", cx: xAt(n - 1), cy: yAt(data[n - 1]), r: 3, fill: color }),
    hover >= 0 && /* @__PURE__ */ React.createElement("circle", { className: "hv-chart__dot", cx: xAt(hover), cy: yAt(data[hover]), r: 3.5, fill: color })
  ), hover >= 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-spark__tooltip", style: { left: `${xAt(hover) / W * 100}%`, top: `${yAt(data[hover]) / height * 100}%` } }, formatValue(data[hover])));
}
export {
  Sparkline
};
