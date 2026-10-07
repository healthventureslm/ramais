import React from "react";
const CSS = `
.hv-tabs { display: flex; gap: 2px; border-bottom: var(--border-hair) solid var(--border-default); }
.hv-tab {
  position: relative; display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-sans); font-size: var(--text-md); font-weight: var(--weight-medium);
  color: var(--text-muted); background: transparent; border: none; cursor: pointer;
  padding: 11px 14px 13px; border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: var(--transition-colors);
}
.hv-tab:hover:not(.hv-tab--active) { color: var(--text-strong); background: var(--state-hover); }
/* A aba e um <button> e nao tinha press. O auditor nao via porque o sujeito do
   seletor acima e .hv-tab, mas a ultima classe escrita e a do :not() \u2014 corrigido
   no audit-token-refs junto com esta linha.
   O press vale tambem na aba ATIVA: reapertar a aba em que voce ja esta e um
   gesto comum (recarregar a lista), e sem retorno ele parece ignorado. */
.hv-tab:active { background: var(--state-press); transition-duration: 0s; }
.hv-tab--active { color: var(--petrol-700); font-weight: var(--weight-semibold); }
.hv-tab::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2.5px;
  border-radius: 3px 3px 0 0; background: var(--petrol-500); transform: scaleX(0);
  transition: transform var(--dur-normal) var(--ease-entrance); }
.hv-tab--active::after { transform: scaleX(1); }
.hv-tab svg { width: 16px; height: 16px; }
.hv-tab__count { font-family: var(--font-mono); font-size: 11px; background: var(--surface-sunken);
  color: var(--text-muted); padding: 1px 6px; border-radius: var(--radius-pill); }
.hv-tab--active .hv-tab__count { background: var(--petrol-100); color: var(--petrol-700); }
.hv-tab:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-sm); }

/* O sublinhado desliza de uma aba para a outra. Sem movimento ele apenas
   aparece sob a aba ativa \u2014 a informacao e a mesma. */
@media (prefers-reduced-motion: reduce) {
  .hv-tab::after { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-tabs-css")) {
  const el = document.createElement("style");
  el.id = "hv-tabs-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Tabs({ items = [], value, defaultValue, onChange, className = "", ...rest }) {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value);
  const active = value !== void 0 ? value : internal;
  const select = (v) => {
    if (value === void 0) setInternal(v);
    onChange && onChange(v);
  };
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-tabs", className].filter(Boolean).join(" "), role: "tablist", ...rest }, items.map((it) => {
    const on = it.value === active;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: it.value,
        type: "button",
        role: "tab",
        "aria-selected": on,
        className: ["hv-tab", on ? "hv-tab--active" : ""].filter(Boolean).join(" "),
        onClick: () => select(it.value)
      },
      it.icon,
      it.label,
      it.count != null && /* @__PURE__ */ React.createElement("span", { className: "hv-tab__count" }, it.count)
    );
  }));
}
export {
  Tabs
};
