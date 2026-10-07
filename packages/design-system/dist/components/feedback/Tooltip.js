import React from "react";
const CSS = `
.hv-tooltip { position: relative; display: inline-flex; }
.hv-tooltip__bubble {
  position: absolute; z-index: 60; pointer-events: none; white-space: nowrap;
  background: var(--surface-inverse); color: var(--text-on-inverse); font-family: var(--font-sans);
  font-size: var(--text-xs); font-weight: var(--weight-medium); line-height: 1.3;
  padding: 6px 9px; border-radius: var(--radius-sm); box-shadow: var(--shadow-md);
  opacity: 0; transform: translateY(2px); transition: opacity var(--dur-fast) var(--ease-standard),
  transform var(--dur-fast) var(--ease-entrance); max-width: 240px; white-space: normal; text-align: center;
}
.hv-tooltip[data-open="true"] .hv-tooltip__bubble { opacity: 1; transform: translateY(0); }
.hv-tooltip__bubble::after { content: ""; position: absolute; width: 7px; height: 7px;
  background: var(--surface-inverse); transform: rotate(45deg); }
.hv-tooltip__bubble--top { bottom: calc(100% + 8px); left: 50%; translate: -50%; }
.hv-tooltip__bubble--top::after { bottom: -3px; left: 50%; margin-left: -3.5px; }
.hv-tooltip__bubble--bottom { top: calc(100% + 8px); left: 50%; translate: -50%; }
.hv-tooltip__bubble--bottom::after { top: -3px; left: 50%; margin-left: -3.5px; }
.hv-tooltip__bubble--right { left: calc(100% + 8px); top: 50%; translate: 0 -50%; }
.hv-tooltip__bubble--right::after { left: -3px; top: 50%; margin-top: -3.5px; }
.hv-tooltip__bubble--left { right: calc(100% + 8px); top: 50%; translate: 0 -50%; }
.hv-tooltip__bubble--left::after { right: -3px; top: 50%; margin-top: -3.5px; }

@media (prefers-reduced-motion: reduce) {
  .hv-tooltip__bubble { transition: opacity var(--dur-fast) linear; transform: none; }
  .hv-tooltip[data-open="true"] .hv-tooltip__bubble { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-tooltip-css")) {
  const el = document.createElement("style");
  el.id = "hv-tooltip-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Tooltip({ content, side = "top", children, className = "", ...rest }) {
  const [open, setOpen] = React.useState(false);
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      className: ["hv-tooltip", className].filter(Boolean).join(" "),
      "data-open": open,
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
      ...rest
    },
    children,
    /* @__PURE__ */ React.createElement("span", { className: `hv-tooltip__bubble hv-tooltip__bubble--${side}`, role: "tooltip" }, content)
  );
}
export {
  Tooltip
};
