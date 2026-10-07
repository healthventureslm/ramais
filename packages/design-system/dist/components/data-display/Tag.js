import React from "react";
const CSS = `
.hv-tag {
  display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-sans);
  font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-body);
  background: var(--surface-card); border: var(--border-hair) solid var(--border-default);
  border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); line-height: 1; white-space: nowrap;
  /* Largura natural que sobrevive ao pai. inline-flex sozinho nao basta:
     como item de um flex column o elemento e esticado no eixo cruzado e
     blockifica para flex \u2014 a pilula viraria uma faixa de ponta a ponta.
     Em ChipGroup nao muda nada: la o eixo e linha, entao o stretch mexia
     na altura, nunca na largura. */
  width: fit-content;
}
.hv-tag__remove {
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  border: none; background: transparent; color: var(--text-muted); padding: 0; margin: -2px -2px -2px 0;
  width: 16px; height: 16px; border-radius: var(--radius-xs);
  transition: var(--transition-colors);
}
.hv-tag__remove:hover { background: var(--state-press); color: var(--text-strong); }
.hv-tag__remove:active { background: var(--state-press-deep); transition-duration: 0s; }
.hv-tag__remove svg { width: 12px; height: 12px; stroke-width: 2.5; }
/* O glifo segue a FAMILIA. Era --petrol-500 cravado, entao o icone de uma Tag
   crimson saia verde \u2014 a peca mais visivel do chip contradizendo a categoria
   que o chip inteiro existe para comunicar. --_lead e definido por familia
   logo abaixo; sem familia ele cai no petrol de antes, que e o comportamento
   correto para a Tag comum. */
.hv-tag__lead { color: var(--_lead, var(--petrol-500)); display: inline-flex; }
.hv-tag[data-family="petrol"]  { --_lead: var(--petrol-500); }
.hv-tag[data-family="emerald"] { --_lead: var(--emerald-700); }
.hv-tag[data-family="amber"]   { --_lead: var(--amber-700); }
.hv-tag[data-family="coral"]   { --_lead: var(--coral-700); }
.hv-tag[data-family="crimson"] { --_lead: var(--crimson-700); }
.hv-tag__lead svg { width: 13px; height: 13px; }

/* ============================================================
   Categorizacao (DS-14) \u2014 eixo duplo: familia x tratamento.

   Onze categorias clinicas nao cabem em cinco matizes, e abrir a paleta para
   azul/violeta cai justamente no visual generico de healthtech que a marca
   evita de proposito. A resposta do sistema e cruzar as cinco familias com
   tres tratamentos: 15 chips distinguiveis sem inventar matiz.

   O filled pesa mais que o outline, que pesa mais que o neutral \u2014 entao a
   ordem das categorias comunica relevancia, nao acaso. Use categoryStyle(i)
   para atribuir de forma estavel.

   Categoria NUNCA usa o par semantico: um chip de "Medicacoes" em --danger-bg
   le como alerta.
   ============================================================ */
.hv-tag[data-family] { border-color: transparent; }

.hv-tag[data-treatment="filled"][data-family="petrol"]  { background: var(--petrol-100);  color: var(--brand-soft-fg); }
.hv-tag[data-treatment="filled"][data-family="emerald"] { background: var(--emerald-100); color: var(--emerald-700); }
.hv-tag[data-treatment="filled"][data-family="amber"]   { background: var(--amber-100);   color: var(--amber-700); }
.hv-tag[data-treatment="filled"][data-family="coral"]   { background: var(--coral-100);   color: var(--coral-700); }
.hv-tag[data-treatment="filled"][data-family="crimson"] { background: var(--crimson-100); color: var(--crimson-700); }

.hv-tag[data-treatment="outline"] { background: transparent; }
.hv-tag[data-treatment="outline"][data-family="petrol"]  { border-color: var(--petrol-400);  color: var(--brand-soft-fg); }
.hv-tag[data-treatment="outline"][data-family="emerald"] { border-color: var(--emerald-500); color: var(--emerald-700); }
.hv-tag[data-treatment="outline"][data-family="amber"]   { border-color: var(--amber-500);   color: var(--amber-700); }
.hv-tag[data-treatment="outline"][data-family="coral"]   { border-color: var(--coral-500);   color: var(--coral-700); }
.hv-tag[data-treatment="outline"][data-family="crimson"] { border-color: var(--crimson-500); color: var(--crimson-700); }

.hv-tag[data-treatment="neutral"] {
  background: var(--cat-neutral-bg); color: var(--cat-neutral-fg);
  border-color: transparent;
}
/* O marcador de familia e um PONTO, nao um filete na aresta.

   O filete era a aba lateral colorida \u2014 o tell mais reconhecivel do catalogo
   de card \u2014 e aqui com um agravante: num raio de 6px o inset de 3px e
   recortado pelo canto e vira uma lasca em meia-lua, que le como artefato de
   render antes de ler como categoria.

   O ponto entra no fluxo como item do flex, entao herda o gap de 6px e
   dispensa o padding-left compensatorio. E da ao tier neutral um mecanismo
   PROPRIO: filled tinge o fundo, outline tinge a borda, neutral marca com cor
   pontual. Tres tratamentos, tres formas diferentes de carregar a familia \u2014
   em vez de tres intensidades da mesma ideia. */
.hv-tag[data-treatment="neutral"]::before {
  content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%;
  background: var(--border-strong);
}
.hv-tag[data-treatment="neutral"][data-family="petrol"]::before  { background: var(--petrol-400); }
.hv-tag[data-treatment="neutral"][data-family="emerald"]::before { background: var(--emerald-500); }
.hv-tag[data-treatment="neutral"][data-family="amber"]::before   { background: var(--amber-500); }
.hv-tag[data-treatment="neutral"][data-family="coral"]::before   { background: var(--coral-500); }
.hv-tag[data-treatment="neutral"][data-family="crimson"]::before { background: var(--crimson-500); }


/* Alternavel \u2014 grade de multipla escolha visivel de uma vez. SegmentedControl
   e escolha unica, MultiSelect e campo com dropdown; nenhum dos dois e uma
   grade de chips. O estado vai em aria-pressed, que e o que faz o leitor de
   tela anunciar ligado/desligado \u2014 nao basta trocar a cor. */
.hv-tag--toggle {
  cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  min-height: var(--tap-min, 44px); padding-inline: var(--space-3);
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
/* So a variante INTERATIVA sobe para --border-control: a Tag comum e
   rotulo, nao controle, e nao tem esse piso de 3:1. */
.hv-tag--toggle { border-color: var(--border-control); }
.hv-tag--toggle:hover:not(:disabled) { border-color: var(--border-control-hover); background: var(--state-hover); }
.hv-tag--toggle:active:not(:disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-tag--toggle:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.hv-tag--toggle[aria-pressed="true"] {
  background: var(--surface-brand-soft); border-color: var(--border-brand);
  color: var(--brand-soft-fg); font-weight: var(--weight-semibold);
}
.hv-tag--toggle:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }

/* Grade: os chips ficam todos visiveis, quebrando linha. */
.hv-chipgroup { display: flex; flex-wrap: wrap; gap: var(--space-2); }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-tag-css")) {
  const el = document.createElement("style");
  el.id = "hv-tag-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const FAMILIAS = ["petrol", "emerald", "amber", "coral", "crimson"];
const TRATAMENTOS = ["filled", "outline", "neutral"];
function categoryStyle(index) {
  const i = (index % 15 + 15) % 15;
  return {
    family: FAMILIAS[i % FAMILIAS.length],
    treatment: TRATAMENTOS[Math.floor(i / FAMILIAS.length)]
  };
}
function ChipGroup({ label, className = "", children, ...rest }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-chipgroup", className].filter(Boolean).join(" "),
      role: "group",
      "aria-label": label,
      ...rest
    },
    children
  );
}
function Tag({
  icon = null,
  onRemove,
  family,
  treatment = "filled",
  pressed,
  onToggle,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const alterna = pressed !== void 0 || Boolean(onToggle);
  const Tag_ = alterna ? "button" : "span";
  return /* @__PURE__ */ React.createElement(
    Tag_,
    {
      className: ["hv-tag", alterna ? "hv-tag--toggle" : "", className].filter(Boolean).join(" "),
      "data-family": family,
      "data-treatment": family ? treatment : void 0,
      type: alterna ? "button" : void 0,
      "aria-pressed": alterna ? Boolean(pressed) : void 0,
      disabled: alterna ? disabled : void 0,
      onClick: alterna && !disabled ? () => onToggle && onToggle(!pressed) : void 0,
      ...rest
    },
    icon && /* @__PURE__ */ React.createElement("span", { className: "hv-tag__lead" }, icon),
    children,
    onRemove && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-tag__remove", "aria-label": "Remover", onClick: onRemove }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" })))
  );
}
export {
  ChipGroup,
  Tag,
  categoryStyle
};
