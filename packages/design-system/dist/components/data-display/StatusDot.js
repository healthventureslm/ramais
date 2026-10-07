import React from "react";
const CSS = `
.hv-statusdot { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-sans);
  font-size: var(--text-sm); color: var(--text-body); }
.hv-statusdot__dot { width: 9px; height: 9px; border-radius: 50%; flex: none; position: relative; }
.hv-statusdot__dot--positive { background: var(--emerald-500); }
.hv-statusdot__dot--warning  { background: var(--amber-500); }
.hv-statusdot__dot--danger   { background: var(--crimson-500); }
.hv-statusdot__dot--neutral  { background: var(--ink-300); }
.hv-statusdot__dot--info     { background: var(--petrol-400); }
.hv-statusdot__dot--live     { background: var(--live); }
.hv-statusdot--pulse .hv-statusdot__dot::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; background: inherit;
  animation: hv-pulse-live 1.6s var(--ease-soft) infinite;
}

/* Pulso infinito e o caso mais incomodo de todos. Parado, o ponto continua
   comunicando o estado pela COR \u2014 nada se perde. */
@media (prefers-reduced-motion: reduce) {
  .hv-statusdot--pulse .hv-statusdot__dot::after { animation: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-statusdot-css")) {
  const el = document.createElement("style");
  el.id = "hv-statusdot-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function StatusDot({ status = "neutral", pulse = false, className = "", children, ...rest }) {
  return /* @__PURE__ */ React.createElement("span", { className: ["hv-statusdot", pulse ? "hv-statusdot--pulse" : "", className].filter(Boolean).join(" "), ...rest }, /* @__PURE__ */ React.createElement("span", { className: `hv-statusdot__dot hv-statusdot__dot--${status}`, "aria-hidden": "true" }), children);
}
export {
  StatusDot
};
