import React from "react";
const CSS = `
.hv-switch { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-sans);
  cursor: pointer; user-select: none; }
.hv-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.hv-switch__track {
  flex: none; width: 40px; height: 23px; border-radius: var(--radius-pill);
  background: var(--border-control); position: relative; transition: background-color var(--dur-normal) var(--ease-standard);
}
.hv-switch__thumb {
  position: absolute; top: 2.5px; left: 2.5px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--white); box-shadow: var(--shadow-sm);
  transition: transform var(--dur-normal) var(--ease-soft);
}
/* O Switch nao tinha hover NEM press: o unico retorno era o polegar
   deslizando depois que o clique ja tinha acontecido. A trilha agora
   escurece um degrau no hover e outro no press, ligada ou desligada. */
.hv-switch:hover input:not(:disabled) ~ .hv-switch__track { background: var(--border-control-hover); }
.hv-switch:active input:not(:disabled) ~ .hv-switch__track { background: var(--text-subtle); transition-duration: 0s; }
.hv-switch input:checked ~ .hv-switch__track { background: var(--action-primary); }
.hv-switch:hover input:checked:not(:disabled) ~ .hv-switch__track { background: var(--action-primary-hover); }
.hv-switch:active input:checked:not(:disabled) ~ .hv-switch__track { background: var(--action-primary-press); }
.hv-switch input:checked ~ .hv-switch__track .hv-switch__thumb { transform: translateX(17px); }
.hv-switch input:focus-visible ~ .hv-switch__track { box-shadow: var(--shadow-focus); }
.hv-switch input:disabled ~ .hv-switch__track { opacity: var(--opacity-disabled); }
.hv-switch--disabled { cursor: not-allowed; }
.hv-switch__label { font-size: var(--text-md); color: var(--text-body); }

/* O polegar desliza. Sem movimento ele salta para o lado \u2014 a posicao
   continua sendo a informacao. */
@media (prefers-reduced-motion: reduce) {
  .hv-switch__thumb { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-switch-css")) {
  const el = document.createElement("style");
  el.id = "hv-switch-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Switch({ label, disabled = false, className = "", ...rest }) {
  return /* @__PURE__ */ React.createElement("label", { className: ["hv-switch", disabled ? "hv-switch--disabled" : "", className].filter(Boolean).join(" ") }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", role: "switch", disabled, ...rest }), /* @__PURE__ */ React.createElement("span", { className: "hv-switch__track", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "hv-switch__thumb" })), label && /* @__PURE__ */ React.createElement("span", { className: "hv-switch__label" }, label));
}
export {
  Switch
};
