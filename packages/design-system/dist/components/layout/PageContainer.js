import React from "react";
const CSS = `
.hv-page {
  width: 100%; margin-inline: auto;
  padding-inline: var(--pad-page);
  padding-block: var(--space-7) var(--space-9);
  display: flex; flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}
.hv-page--wide    { max-width: var(--content-max); }
.hv-page--regular { max-width: 64rem; }
.hv-page--narrow  { max-width: 56rem; }
.hv-page--reading { max-width: var(--reading-max); }
.hv-page--full    { max-width: none; }

/* Densidades. O flush serve para quando o container vive dentro de um painel
   que j\xE1 tem o pr\xF3prio padding \u2014 evita o padding duplo. */
.hv-page--tight { gap: var(--space-4); padding-block: var(--space-5) var(--space-7); }
.hv-page--flush { padding-inline: 0; }

/* No mobile a margem lateral encolhe e o rodape reserva a tab bar: sem isso o
   ultimo item da pagina fica embaixo da barra e nao da para tocar.

   A reserva e opcional (tabbar={false}): um produto que navega por sidebar e
   nao tem TabBar ganharia a altura dela de espaco morto em toda pagina.

   O --safe-bottom fica FORA da conta da tab bar de proposito. Ele protege o
   indicador de home e vale com ou sem barra \u2014 embuti-lo no --tabbar-total
   faria a protecao do notch desaparecer junto com a reserva. */
@media (max-width: 767px) {
  .hv-page {
    padding-inline: var(--pad-screen, var(--space-4));
    padding-block: var(--space-4)
      calc(var(--safe-bottom, 0px) + var(--tabbar-height, 0px) + var(--space-6));
    gap: var(--space-5);
  }
  .hv-page[data-tabbar="false"] {
    padding-block: var(--space-4) calc(var(--safe-bottom, 0) + var(--space-6));
  }
}
[data-hv-platform="mobile"] .hv-page {
  padding-inline: var(--pad-screen, var(--space-4));
  padding-block: var(--space-4)
    calc(var(--safe-bottom, 0px) + var(--tabbar-height, 0px) + var(--space-6));
  gap: var(--space-5);
}
[data-hv-platform="mobile"] .hv-page[data-tabbar="false"] {
  padding-block: var(--space-4) calc(var(--safe-bottom, 0) + var(--space-6));
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-page-css")) {
  const el = document.createElement("style");
  el.id = "hv-page-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function PageContainer({
  width = "regular",
  density = "regular",
  flush = false,
  tabbar = true,
  as = "div",
  className = "",
  children,
  ...rest
}) {
  const Tag = as;
  return /* @__PURE__ */ React.createElement(
    Tag,
    {
      className: [
        "hv-page",
        `hv-page--${width}`,
        density === "tight" ? "hv-page--tight" : "",
        flush ? "hv-page--flush" : "",
        className
      ].filter(Boolean).join(" "),
      "data-tabbar": tabbar ? void 0 : "false",
      ...rest
    },
    children
  );
}
export {
  PageContainer
};
