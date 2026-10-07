import React from "react";
import { Sheet } from "./Sheet.js";
const CSS = `
.hv-actionsheet__list {
  display: flex; flex-direction: column;
  margin: 0 calc(var(--space-4) * -1);
}

.hv-actionsheet__item {
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%; min-height: var(--tap-large, 56px);
  padding: var(--space-3) var(--space-4);
  border: none; background: transparent; cursor: pointer; text-align: left;
  font: var(--weight-medium) var(--text-lg)/1.3 var(--font-sans);
  color: var(--text-body);
  border-top: var(--border-hair) solid var(--border-subtle);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background-color var(--dur-fast) var(--ease-standard);
}
.hv-actionsheet__list > .hv-actionsheet__item:first-child { border-top: none; }
.hv-actionsheet__item:active { background: var(--state-press); }
.hv-actionsheet__item:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
/* Par desenhado, nao opacidade. Aqui o DS controla a cor de TODO o texto, que e
   a condicao que a isencao de opacidade nao cobre.

   Medido (claro, sobre --surface-card): --state-disabled-fg da 3,10:1 sempre.
   O opacity 0.5 dava de 2,26 a 3,28 no MESMO componente, porque o resultado
   depende da cor de partida \u2014 texto que comecava em --text-muted caia mais que
   texto que comecava em --text-strong. O ganho aqui e previsibilidade, nao
   contraste: nenhum dos dois alcanca 4,5, e o teto de qualquer opacity 0.5 e
   3,98 (preto puro). Ver a nota de contraste no DESIGN.md. */
.hv-actionsheet__item[disabled] { color: var(--state-disabled-fg); cursor: not-allowed; }

.hv-actionsheet__icon { flex: none; display: inline-flex; color: var(--text-subtle); }
.hv-actionsheet__icon svg { width: 20px; height: 20px; display: block; }
.hv-actionsheet__text { flex: 1; min-width: 0; }
.hv-actionsheet__sub {
  display: block; font: var(--text-sm)/1.35 var(--font-sans);
  color: var(--text-muted); margin-top: var(--nudge-2);
}

/* Destrutivo em vermelho e SEMPRE por \xFAltimo: no polegar, o item mais alto da
   lista \xE9 o mais f\xE1cil de acertar sem olhar. */
.hv-actionsheet__item[data-danger="true"] { color: var(--danger-fg); }
.hv-actionsheet__item[data-danger="true"] .hv-actionsheet__icon { color: var(--danger-fg); }

/* Cancelar fica separado, num bloco pr\xF3prio: \xE9 o que permite dispensar sem
   mirar, e distinguir visualmente evita o toque errado. */
.hv-actionsheet__cancel {
  display: flex; align-items: center; justify-content: center;
  width: 100%; min-height: var(--tap-large, 56px);
  margin-top: var(--space-2);
  border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-card-m, 20px);
  background: var(--surface-raised); cursor: pointer;
  font: var(--weight-semibold) var(--text-lg)/1 var(--font-sans);
  color: var(--text-strong);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background-color var(--dur-fast) var(--ease-standard);
}
.hv-actionsheet__cancel:active { background: var(--state-press); }
.hv-actionsheet__cancel:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-actionsheet-css")) {
  const el = document.createElement("style");
  el.id = "hv-actionsheet-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function ActionSheet({
  open = false,
  onClose,
  title,
  description,
  items = [],
  cancelLabel = "Cancelar",
  showCancel = true,
  container,
  className = "",
  ...rest
}) {
  const listaRef = React.useRef(null);
  const navegarPorSeta = (e) => {
    const itens = listaRef.current ? [...listaRef.current.querySelectorAll("button:not(:disabled)")] : [];
    if (!itens.length) return;
    const i = itens.indexOf(document.activeElement);
    const ir = (n) => {
      e.preventDefault();
      itens[(n + itens.length) % itens.length].focus();
    };
    if (e.key === "ArrowDown") ir(i + 1);
    else if (e.key === "ArrowUp") ir(i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(itens.length - 1);
  };
  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const primeiro = listaRef.current && listaRef.current.querySelector("button:not(:disabled)");
      primeiro && primeiro.focus();
    }, 60);
    return () => clearTimeout(id);
  }, [open]);
  const acionar = (item) => {
    if (item.disabled) return;
    onClose && onClose();
    item.onSelect && item.onSelect(item.id);
  };
  return /* @__PURE__ */ React.createElement(
    Sheet,
    {
      open,
      onClose,
      title,
      description,
      grabber: false,
      detents: [1],
      container,
      className: ["hv-actionsheet", className].filter(Boolean).join(" "),
      style: { height: "auto" },
      ...rest
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-actionsheet__list", role: "menu", ref: listaRef, onKeyDown: navegarPorSeta }, items.map((item, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: item.id || i,
        type: "button",
        role: "menuitem",
        className: "hv-actionsheet__item",
        "data-danger": item.danger ? "true" : void 0,
        disabled: item.disabled,
        onClick: () => acionar(item)
      },
      item.icon && /* @__PURE__ */ React.createElement("span", { className: "hv-actionsheet__icon", "aria-hidden": "true" }, item.icon),
      /* @__PURE__ */ React.createElement("span", { className: "hv-actionsheet__text" }, item.label, item.description && /* @__PURE__ */ React.createElement("span", { className: "hv-actionsheet__sub" }, item.description))
    ))),
    showCancel && onClose && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-actionsheet__cancel", onClick: onClose }, cancelLabel)
  );
}
export {
  ActionSheet
};
