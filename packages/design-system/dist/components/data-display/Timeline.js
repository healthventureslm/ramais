import React from "react";
const CSS = `
.hv-timeline { list-style: none; margin: 0; padding: 0; font-family: var(--font-sans); }

.hv-timeline__item {
  --_accent: var(--border-strong);
  position: relative;
  display: flex;
  gap: var(--space-3);
  padding-bottom: var(--space-5);
}
.hv-timeline__item:last-child { padding-bottom: 0; }

.hv-timeline__item[data-status="primary"]  { --_accent: var(--petrol-500); }
.hv-timeline__item[data-status="positive"] { --_accent: var(--emerald-500); }
.hv-timeline__item[data-status="warning"]  { --_accent: var(--amber-500); }
.hv-timeline__item[data-status="danger"]   { --_accent: var(--coral-500); }
.hv-timeline__item[data-status="info"]     { --_accent: var(--petrol-400); }

.hv-timeline__rail { position: relative; flex: none; display: flex; justify-content: center; width: 30px; }

/* Connecting line between markers */
.hv-timeline__item:not(:last-child) .hv-timeline__rail::after {
  content: "";
  position: absolute;
  top: 30px;
  bottom: calc(-1 * var(--space-5));
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  background: var(--border-default);
  border-radius: var(--radius-pill);
}

.hv-timeline__dot {
  position: relative;
  z-index: 1;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--dur-fast) var(--ease-standard);
}
.hv-timeline__dot--icon {
  background: var(--surface-card);
  border: 2px solid var(--_accent);
  color: var(--_accent);
  box-shadow: var(--shadow-xs);
}
.hv-timeline__dot--icon.hv-timeline__dot--solid {
  background: var(--_accent);
  color: var(--text-on-accent);
  border-color: transparent;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--_accent) 14%, transparent), var(--shadow-xs);
}
.hv-timeline__dot svg { width: 15px; height: 15px; display: block; }

.hv-timeline__marker {
  width: 13px;
  height: 13px;
  border-radius: var(--radius-pill);
  background: var(--_accent);
  box-shadow: 0 0 0 3px var(--surface-card), 0 0 0 6px color-mix(in srgb, var(--_accent) 16%, transparent);
}

.hv-timeline__item:hover .hv-timeline__dot { transform: scale(1.08); }

.hv-timeline__content { flex: 1; min-width: 0; padding-top: var(--space-1); }
.hv-timeline__time {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 3px;
}
.hv-timeline__title { font-size: var(--text-md); font-weight: 600; color: var(--text-strong); line-height: var(--leading-snug); }
.hv-timeline__desc { font-size: var(--text-sm); color: var(--text-body); margin-top: 3px; line-height: var(--leading-normal); }

/* ---- size: sm (compacto) ---- */
.hv-timeline--sm .hv-timeline__item { padding-bottom: var(--space-3); gap: var(--space-2); }
.hv-timeline--sm .hv-timeline__rail { width: 22px; }
.hv-timeline--sm .hv-timeline__dot { width: 22px; height: 22px; }
.hv-timeline--sm .hv-timeline__dot svg { width: 12px; height: 12px; }
.hv-timeline--sm .hv-timeline__marker { width: 10px; height: 10px; }
.hv-timeline--sm .hv-timeline__item:not(:last-child) .hv-timeline__rail::after { top: 22px; bottom: calc(-1 * var(--space-3)); }
.hv-timeline--sm .hv-timeline__content { padding-top: 2px; }
.hv-timeline--sm .hv-timeline__title { font-size: var(--text-sm); }
.hv-timeline--sm .hv-timeline__desc { font-size: var(--text-xs); }

/* ---- variant: alternate (zig-zag) ---- */
.hv-timeline--alternate { position: relative; }
.hv-timeline--alternate::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--border-default);
  transform: translateX(-50%);
  border-radius: var(--radius-pill);
}
.hv-timeline--alternate .hv-timeline__item {
  width: 50%;
  box-sizing: border-box;
  padding-bottom: var(--space-6);
}
.hv-timeline--alternate .hv-timeline__rail { position: absolute; top: 0; width: 30px; }
.hv-timeline--alternate .hv-timeline__rail::after { display: none; }
.hv-timeline--alternate .hv-timeline__content { padding-top: 0; }
.hv-timeline--alternate .hv-timeline__item:nth-child(odd) {
  left: 0;
  text-align: right;
  padding-right: calc(var(--space-5) + 15px);
}
.hv-timeline--alternate .hv-timeline__item:nth-child(odd) .hv-timeline__rail { right: -15px; }
.hv-timeline--alternate .hv-timeline__item:nth-child(even) {
  left: 50%;
  padding-left: calc(var(--space-5) + 15px);
}
.hv-timeline--alternate .hv-timeline__item:nth-child(even) .hv-timeline__rail { left: -15px; }

/* ---- variant: horizontal ---- */
.hv-timeline--horizontal { display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-2); }
.hv-timeline--horizontal .hv-timeline__item { flex: 1 1 0; min-width: 150px; flex-direction: column; padding-bottom: 0; gap: var(--space-2); }
.hv-timeline--horizontal .hv-timeline__rail { width: 100%; height: 30px; justify-content: flex-start; align-items: center; }
.hv-timeline--horizontal .hv-timeline__item:not(:last-child) .hv-timeline__rail::after {
  top: 50%;
  left: 30px;
  right: calc(-1 * var(--space-2));
  bottom: auto;
  width: auto;
  height: 2px;
  transform: translateY(-50%);
}
.hv-timeline--horizontal .hv-timeline__content { padding-top: 0; }

@media (prefers-reduced-motion: reduce) {
  .hv-timeline__item:hover .hv-timeline__dot { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-timeline-css")) {
  const el = document.createElement("style");
  el.id = "hv-timeline-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Timeline({ items = [], variant = "default", size = "md", className = "", ...rest }) {
  const cls = [
    "hv-timeline",
    variant !== "default" ? `hv-timeline--${variant}` : "",
    size !== "md" ? `hv-timeline--${size}` : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("ol", { className: cls, ...rest }, items.map((it, i) => {
    const status = it.status || "default";
    const hasIcon = !!it.icon;
    const dotCls = [
      "hv-timeline__dot",
      hasIcon ? "hv-timeline__dot--icon" : "",
      hasIcon && it.solid ? "hv-timeline__dot--solid" : ""
    ].filter(Boolean).join(" ");
    return /* @__PURE__ */ React.createElement("li", { key: it.id != null ? it.id : i, className: "hv-timeline__item", "data-status": status }, /* @__PURE__ */ React.createElement("div", { className: "hv-timeline__rail" }, /* @__PURE__ */ React.createElement("span", { className: dotCls }, hasIcon ? it.icon : /* @__PURE__ */ React.createElement("span", { className: "hv-timeline__marker" }))), /* @__PURE__ */ React.createElement("div", { className: "hv-timeline__content" }, it.time != null && /* @__PURE__ */ React.createElement("span", { className: "hv-timeline__time" }, it.time), it.title != null && /* @__PURE__ */ React.createElement("div", { className: "hv-timeline__title" }, it.title), it.description != null && /* @__PURE__ */ React.createElement("div", { className: "hv-timeline__desc" }, it.description), it.children));
  }));
}
export {
  Timeline
};
