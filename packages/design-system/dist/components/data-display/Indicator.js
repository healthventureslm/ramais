import React from "react";
const CSS = `
.hv-indicator {
  position: absolute; z-index: 1; pointer-events: none;
  min-width: 8px; height: 8px; border-radius: var(--radius-pill);
  /* O padrao era var(--live), com o comentario "coral, a cor de atencao da
     marca". O DESIGN.md diz outra coisa: coral e --live, reservado a processo
     com relogio correndo. Uma contagem de nao lidos e estado parado \u2014 e todo
     sino, aba, sidebar e chat do sistema pintava o contador com a tinta da
     assinatura. O padrao agora e o acento unico. Quem sinaliza gravacao de
     verdade continua passando tone="live". */
  background: var(--action-primary); color: var(--action-primary-text);
  /* O anel recorta o indicador da superf\xEDcie embaixo, para ele n\xE3o encostar
     no \xEDcone. currentColor n\xE3o serve: a superf\xEDcie varia (vidro, cart\xE3o,
     chrome de marca), ent\xE3o quem monta informa via --hv-indicator-ring. */
  box-shadow: 0 0 0 2px var(--hv-indicator-ring, var(--surface-card));
}

.hv-indicator--count {
  min-width: 17px; height: 17px; padding: 0 5px;
  font: var(--weight-semibold) 10px/17px var(--font-mono);
  text-align: center;
}

/* Tons. O padrao (brand) esta na regra base acima. */
.hv-indicator--live     { background: var(--live); color: var(--text-on-accent); }
/* Sobre superficie de MARCA, petrol some em petrol: la o contador vira luz.
   E a mesma doutrina do --veil-*, e como a superficie de marca e petrol-900
   nos dois temas, este par tambem nao muda por tema. */
.hv-indicator--on-brand { background: var(--text-on-brand); color: var(--surface-brand); }
/* Os tons herdavam a tinta da base (--action-primary-text), que no escuro e
   petrol-950: numero escuro sobre crimson-600 dava 3,5:1. O par agora vem da
   rampa semantica \u2014 o -fg do tom vira preenchimento e a superficie vira
   glifo. Nos dois temas a -fg ja e a tinta que le sobre cartao, entao o
   inverso tambem le. */
.hv-indicator--danger   { background: var(--danger-fg);   color: var(--surface-card); }
.hv-indicator--positive { background: var(--positive-fg); color: var(--surface-card); }
.hv-indicator--neutral  { background: var(--text-muted);  color: var(--surface-card); }

/* Cantos. O deslocamento negativo faz a marca "morder" a borda do controle. */
.hv-indicator--top-right    { top: -3px; right: -3px; }
.hv-indicator--top-left     { top: -3px; left: -3px; }
.hv-indicator--inset        { top: 0; right: 4px; }

/* Sem contador o ponto encolhe e pode ficar mais para dentro. */
.hv-indicator:not(.hv-indicator--count).hv-indicator--top-right { top: -1px; right: -1px; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-indicator-css")) {
  const el = document.createElement("style");
  el.id = "hv-indicator-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Indicator({
  // SEM default: em JS o default de parametro vale para `undefined`, entao
  // `value = true` faria `<Indicator value={item.badge} />` pintar um ponto em
  // TODO item sem badge. Passe o valor cru; ausencia nao renderiza nada.
  value,
  tone = "brand",
  position = "top-right",
  max = 99,
  label,
  ring,
  className = "",
  ...rest
}) {
  if (!value) return null;
  const isCount = typeof value === "number" || typeof value === "string";
  const texto = typeof value === "number" && value > max ? `${max}+` : value;
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      className: [
        "hv-indicator",
        isCount ? "hv-indicator--count" : "",
        tone !== "brand" ? `hv-indicator--${tone}` : "",
        `hv-indicator--${position}`,
        className
      ].filter(Boolean).join(" "),
      style: ring ? { "--hv-indicator-ring": ring } : void 0,
      "aria-hidden": isCount ? void 0 : "true",
      role: isCount ? "status" : void 0,
      "aria-label": isCount && label ? label : void 0,
      ...rest
    },
    isCount ? texto : null
  );
}
export {
  Indicator
};
