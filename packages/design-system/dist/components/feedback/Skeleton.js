import React from "react";
const CSS = `
.hv-skel {
  display: block; border-radius: var(--radius-sm); background-color: var(--sand-200);
  background-image: linear-gradient(90deg,
    transparent 0%, var(--shimmer) 50%, transparent 100%);
  background-size: 220% 100%; background-repeat: no-repeat;
  animation: hv-shimmer 1.4s var(--ease-soft) infinite;
}
.hv-skel--text { height: 0.78em; border-radius: var(--radius-xs); margin: 0.2em 0; }
.hv-skel--circle { border-radius: 50%; }
@media (prefers-reduced-motion: reduce) { .hv-skel { animation: none; } }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-skel-css")) {
  const el = document.createElement("style");
  el.id = "hv-skel-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Skeleton({ variant = "block", width, height, lines = 1, className = "", style = {}, ...rest }) {
  if (variant === "text" && lines > 1) {
    return (
      // Placeholder e DECORACAO: quem anuncia o carregamento e o container,
      // com aria-busy. Sem isto, o leitor de tela percorre caixas vazias.
      /* @__PURE__ */ React.createElement("span", { style: { display: "block" }, "aria-hidden": "true", ...rest }, Array.from({ length: lines }).map((_, i) => /* @__PURE__ */ React.createElement(
        "span",
        {
          key: i,
          className: "hv-skel hv-skel--text",
          style: { width: i === lines - 1 ? "62%" : "100%", ...style }
        }
      )))
    );
  }
  const cls = ["hv-skel", variant === "text" ? "hv-skel--text" : "", variant === "circle" ? "hv-skel--circle" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("span", { className: cls, style: { width, height, ...style }, "aria-hidden": "true", ...rest });
}
export {
  Skeleton
};
