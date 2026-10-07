import React from "react";
import { Sparkline } from "../charts/Sparkline.js";
import { Badge } from "./Badge.js";
const CSS = `
/* O cartao e um INSTRUMENTO DE LEITURA, nao um tile de dashboard.
   A versao anterior era o tile generico que qualquer kit gera: chip pastel
   arredondado no topo, rotulo em caixa alta, numero enorme na fonte de
   display. Quatro lado a lado viravam um arco-iris de pastilhas coloridas
   e nenhum deles parecia deste produto.

   Tres mudancas, todas vindas de regra que o DS ja tinha escrita:

   1. O numero vai em MONO. O readme manda todo sinal vital, codigo, MRN e
      timestamp em IBM Plex Mono, porque mono significa "isto e dado, nao
      prosa". O valor de um StatCard e exatamente isso. Uma fileira de
      cartoes em mono le como painel clinico; em display, como landing page.
   2. O chip pastel virou GLIFO. Sem preenchimento, na linha do rotulo, no
      tamanho do texto. O peso visual pertence ao numero \u2014 era ele que
      estava competindo com uma decoracao de 40px.
   3. O sotaque sobrevive na TINTA do glifo, pelos papeis semanticos
      (positive/warning/live/danger), nao numa pastilha de fundo. Um cartao
      de pendencias continua lendo ambar; ele so parou de gritar. */
.hv-statcard {
  display: flex; flex-direction: column; gap: var(--space-1); box-sizing: border-box;
  background: var(--surface-card); border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4); box-shadow: var(--shadow-sm); font-family: var(--font-sans);
}
/* interactive dava cursor e hover, mas o elemento continuava um <div>:
   sem ordem de tabulacao, sem teclado e sem anel. Clicavel no mouse,
   inexistente no teclado \u2014 o mesmo defeito do <th> ordenavel do Table.
   Se o cartao ja contem o proprio link, use o link e NAO interactive:
   role=button achata o conteudo para o leitor de tela. */
.hv-statcard--interactive:focus-visible { outline: none; box-shadow: var(--shadow-focus), var(--shadow-md); }
.hv-statcard--interactive { cursor: pointer; transition: transform var(--dur-fast) var(--ease-standard),
  box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard); }
/* Era translateY(-2px): o cartao que levita no hover e um tell de UI gerada,
   e contradiz a doutrina de motion do proprio DS ("curto, suave, nunca
   saltitante em contexto clinico"). O degrau de borda + sombra diz a mesma
   coisa sem mover a leitura de lugar. */
.hv-statcard--interactive:hover { box-shadow: var(--shadow-md); border-color: var(--border-control); }
.hv-statcard--interactive:active { background: var(--state-hover); transition-duration: 0s; }

/* Linha do rotulo: glifo + rotulo, e o rotulo tem a linha INTEIRA.
   A tendencia ficava aqui e espremia o rotulo ate reticencia \u2014 "PACIENTES ..."
   e "TEMPO DE ES..." num cartao de 230px. Ela desceu para a linha do valor,
   que e curto (128, 97%, 12 min) e sobra espaco: e la que ela pertence de
   qualquer forma, porque quem ela qualifica e o numero, nao o rotulo. */
.hv-statcard__top { display: flex; align-items: center; gap: var(--space-2); min-height: 20px; }
.hv-statcard__head { display: inline-flex; align-items: center; gap: var(--space-2); min-width: 0; }
.hv-statcard__valuerow { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.hv-statcard__icon { flex: none; display: inline-flex; align-items: center; justify-content: center;
  color: var(--text-muted); }
.hv-statcard__icon svg { width: 16px; height: 16px; display: block; }
.hv-statcard[data-accent="emerald"] .hv-statcard__icon { color: var(--positive-fg); }
.hv-statcard[data-accent="amber"]   .hv-statcard__icon { color: var(--warning-fg); }
.hv-statcard[data-accent="crimson"] .hv-statcard__icon { color: var(--danger-fg); }
/* Nao ha data-accent="coral".

   O coral e --live, e --live e reservado: so vale para processo com relogio
   correndo. O valor de um StatCard e por definicao um numero PARADO \u2014 nao
   existe StatCard cujo dado esteja acontecendo agora.

   O custo de ter deixado passar nao era de gosto, era de erosao: cada numero
   estatico tingido de coral cobra um pouco do significado que a pilula LIVE
   precisa ter quando aparece de verdade. Os dois usos que existiam no repo
   provam o ponto \u2014 "Leitos ocupados 86%" e "Rastreavel e auditavel", nenhum
   dos dois um processo.

   Estado parado tem os quatro papeis semanticos: positive, warning, danger, e
   a ausencia de sotaque. */

/* Mesmos valores de .hv-overline \u2014 o rotulo pequeno tracked-out do sistema.
   Antes usava 0.08em, um terceiro valor de tracking que nao existia em
   lugar nenhum: --tracking-wide e 0.04 e --tracking-wider e 0.12. */
.hv-statcard__label { font-size: var(--text-2xs); font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--text-muted);
  min-width: 0; overflow-wrap: anywhere; }
.hv-statcard__value { font-family: var(--font-mono); font-weight: var(--weight-medium);
  font-size: var(--text-2xl); line-height: var(--leading-tight); color: var(--text-strong);
  letter-spacing: var(--tracking-snug); }
.hv-statcard__hint { font-size: var(--text-xs); color: var(--text-muted); line-height: var(--leading-snug); }
.hv-statcard__spark { margin-top: var(--space-2); }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-statcard-css")) {
  const el = document.createElement("style");
  el.id = "hv-statcard-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props });
const ARROWS = {
  up: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M12 19V5" }), /* @__PURE__ */ React.createElement("path", { d: "m5 12 7-7 7 7" })),
  down: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M12 5v14" }), /* @__PURE__ */ React.createElement("path", { d: "m19 12-7 7-7-7" })),
  flat: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M5 12h14" }))
};
const SPARK_COLOR = {
  petrol: "var(--petrol-500)",
  emerald: "var(--emerald-500)",
  amber: "var(--amber-500)",
  crimson: "var(--crimson-500)"
};
function TrendPill({ trend }) {
  const dir = trend.direction || "flat";
  const positive = trend.positive != null ? trend.positive : dir === "up" ? true : dir === "down" ? false : null;
  const variant = positive === true ? "positive" : positive === false ? "danger" : "neutral";
  return /* @__PURE__ */ React.createElement(Badge, { variant }, ARROWS[dir] || ARROWS.flat, trend.value);
}
function StatCard({
  icon,
  label,
  value,
  hint,
  trend,
  accent = "petrol",
  sparkline,
  sparklineData,
  sparklineColor,
  interactive = false,
  className = "",
  ...rest
}) {
  const cls = ["hv-statcard", interactive ? "hv-statcard--interactive" : "", className].filter(Boolean).join(" ");
  let sparkNode = sparkline;
  if (!sparkNode && sparklineData && sparklineData.length) {
    sparkNode = /* @__PURE__ */ React.createElement(Sparkline, { data: sparklineData, color: sparklineColor || SPARK_COLOR[accent] || SPARK_COLOR.petrol, height: 36 });
  }
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: cls,
      "data-accent": accent,
      tabIndex: interactive ? 0 : void 0,
      role: interactive ? "button" : void 0,
      onKeyDown: interactive ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      } : void 0,
      ...rest
    },
    (icon || label != null) && /* @__PURE__ */ React.createElement("div", { className: "hv-statcard__top" }, /* @__PURE__ */ React.createElement("span", { className: "hv-statcard__head" }, icon && /* @__PURE__ */ React.createElement("span", { className: "hv-statcard__icon" }, icon), label != null && /* @__PURE__ */ React.createElement("span", { className: "hv-statcard__label" }, label))),
    (value != null || trend) && /* @__PURE__ */ React.createElement("div", { className: "hv-statcard__valuerow" }, value != null ? /* @__PURE__ */ React.createElement("div", { className: "hv-statcard__value" }, value) : /* @__PURE__ */ React.createElement("span", null), trend && /* @__PURE__ */ React.createElement(TrendPill, { trend })),
    hint != null && /* @__PURE__ */ React.createElement("div", { className: "hv-statcard__hint" }, hint),
    sparkNode && /* @__PURE__ */ React.createElement("div", { className: "hv-statcard__spark" }, sparkNode)
  );
}
export {
  StatCard
};
