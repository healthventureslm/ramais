import React from "react";
const CSS = `
.hv-insert {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 100%; border: none; background: transparent; cursor: pointer;
  font-family: var(--font-sans); color: var(--text-subtle);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: color var(--dur-fast) var(--ease-standard);
}
.hv-insert:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

/* --- subtle: entre itens --- */
.hv-insert--subtle {
  height: var(--tap-min);      /* alvo de 44px \u2026 */
  margin-block: calc(var(--tap-min) / -2 + var(--space-1));  /* \u2026 sem ocupar 44px de layout */
}
.hv-insert--subtle .hv-insert__rule {
  position: absolute; left: 0; right: 0; height: var(--border-hair);
  background: var(--border-brand); opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-standard);
}
.hv-insert--subtle .hv-insert__plus {
  position: relative; width: 22px; height: 22px; border-radius: var(--radius-pill);
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--action-primary); color: var(--action-primary-text);
  opacity: 0; transform: scale(0.7);
  transition: opacity var(--dur-fast) var(--ease-standard),
              transform var(--dur-normal) var(--ease-spring);
}
.hv-insert--subtle:hover .hv-insert__rule,
.hv-insert--subtle:focus-visible .hv-insert__rule { opacity: 1; }
.hv-insert--subtle:hover .hv-insert__plus,
.hv-insert--subtle:focus-visible .hv-insert__plus { opacity: 1; transform: scale(1); }

/* Sem hover (toque), a r\xE9gua fica sempre vis\xEDvel em tom fraco: um alvo que s\xF3
   aparece no hover \xE9 inalcan\xE7\xE1vel no celular. */
@media (hover: none) {
  .hv-insert--subtle .hv-insert__rule { opacity: 0.35; }
  .hv-insert--subtle .hv-insert__plus { opacity: 1; transform: scale(1); }
}

/* --- prominent: no fim da lista --- */
.hv-insert--prominent {
  min-height: 56px; gap: var(--space-2); padding: var(--space-3);
  border: var(--border-thick) dashed var(--border-default);
  border-radius: var(--radius-lg);
  font: var(--weight-semibold) var(--text-sm)/1 var(--font-sans);
  /* A base e --text-subtle porque o modo discreto e so um "+" sobre a regua.
     O prominent escreve uma frase ("Adicionar secao"): texto que se le. */
  color: var(--text-muted);
  transition: var(--transition-colors);
}
.hv-insert--prominent:hover {
  border-color: var(--border-brand); color: var(--text-link);
  background: var(--surface-brand-soft);
}
.hv-insert--prominent:active {
  border-color: var(--border-brand); color: var(--text-link);
  background: var(--petrol-100); transition-duration: 0s;
}
.hv-insert--prominent .hv-insert__plus { display: inline-flex; }
.hv-insert--prominent svg { width: 17px; height: 17px; display: block; }

.hv-insert__plus svg { width: 14px; height: 14px; display: block; }
/* Par desenhado, nao opacidade. Aqui o DS controla a cor de TODO o texto, que e
   a condicao que a isencao de opacidade nao cobre.

   Medido (claro, sobre --surface-card): --state-disabled-fg da 3,10:1 sempre.
   O opacity 0.5 dava de 2,26 a 3,28 no MESMO componente, porque o resultado
   depende da cor de partida \u2014 texto que comecava em --text-muted caia mais que
   texto que comecava em --text-strong. O ganho aqui e previsibilidade, nao
   contraste: nenhum dos dois alcanca 4,5, e o teto de qualquer opacity 0.5 e
   3,98 (preto puro). Ver a nota de contraste no DESIGN.md. */
.hv-insert[disabled] { color: var(--state-disabled-fg); cursor: not-allowed; }
.hv-insert--prominent[disabled] { border-color: var(--state-disabled-bd); background: transparent; }

@media (prefers-reduced-motion: reduce) {
  .hv-insert--subtle .hv-insert__plus { transition: opacity var(--dur-fast) linear; transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-insert-css")) {
  const el = document.createElement("style");
  el.id = "hv-insert-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Plus = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.6", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M12 5v14M5 12h14" }));
function InsertDivider({
  variant = "subtle",
  label,
  onInsert,
  disabled = false,
  className = "",
  ...rest
}) {
  const rotulo = label || "Inserir item aqui";
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: ["hv-insert", `hv-insert--${variant}`, className].filter(Boolean).join(" "),
      onClick: onInsert,
      disabled,
      "aria-label": variant === "subtle" ? rotulo : void 0,
      ...rest
    },
    variant === "subtle" && /* @__PURE__ */ React.createElement("span", { className: "hv-insert__rule", "aria-hidden": "true" }),
    /* @__PURE__ */ React.createElement("span", { className: "hv-insert__plus", "aria-hidden": "true" }, Plus),
    variant === "prominent" && /* @__PURE__ */ React.createElement("span", null, rotulo)
  );
}
export {
  InsertDivider
};
