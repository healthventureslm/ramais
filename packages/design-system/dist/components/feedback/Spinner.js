import React from "react";
const CSS = `
.hv-spinner { display: inline-block; border-radius: 50%; border-style: solid;
  border-color: var(--petrol-200); border-right-color: var(--petrol-600);
  animation: hv-spin 0.7s linear infinite; vertical-align: middle; }
.hv-spinner--sm { width: 16px; height: 16px; border-width: 2px; }
.hv-spinner--md { width: 22px; height: 22px; border-width: 2.5px; }
.hv-spinner--lg { width: 34px; height: 34px; border-width: 3px; }
.hv-spinner--on-brand { border-color: var(--veil-edge); border-right-color: var(--white); }

/* O spinner NAO para: parado ele deixa de comunicar que algo esta correndo,
   que e a unica coisa que ele faz. Desacelera, como o do Button. */
@media (prefers-reduced-motion: reduce) {
  .hv-spinner { animation-duration: 1.4s; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-spinner-css")) {
  const el = document.createElement("style");
  el.id = "hv-spinner-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Spinner({ size = "md", onBrand = false, label = "Carregando", className = "", ...rest }) {
  const cls = ["hv-spinner", `hv-spinner--${size}`, onBrand ? "hv-spinner--on-brand" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("span", { className: cls, role: "status", "aria-label": label, ...rest });
}
export {
  Spinner
};
