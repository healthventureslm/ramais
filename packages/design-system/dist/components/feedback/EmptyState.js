import React from "react";
import { Spinner } from "./Spinner.js";
const CSS = `
/* Alinhado a ESQUERDA por padrao.
   O empty state anterior era o canonico de sistema gerado: circulo de 56px
   com um glifo dentro, tudo centralizado, titulo, descricao e dois botoes
   empilhados no eixo. O circulo e a peca que mais denuncia geracao e a que
   menos informa \u2014 e um enfeite ocupando o lugar onde deveria estar a frase
   que explica por que a lista esta vazia.

   Texto centralizado tambem custa leitura: cada linha comeca numa posicao
   diferente, e o olho perde a margem de retorno. Numa tela de plantao, o
   vazio e informacao operacional ("nao ha nada pendente"), nao uma tela de
   boas-vindas.

   align="center" continua disponivel para o caso legitimo \u2014 a caixa
   pequena e quadrada, dentro de um card estreito, onde a esquerda nao tem
   de onde comecar. */
.hv-empty {
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  text-align: left; gap: var(--space-2);
  padding: var(--space-7) var(--space-6); box-sizing: border-box;
  font-family: var(--font-sans); color: var(--text-muted);
}
.hv-empty--center { align-items: center; text-align: center; }
.hv-empty--sm { padding: var(--space-5); gap: var(--space-2); }
.hv-empty--lg { padding: var(--space-9) var(--space-8); gap: var(--space-3); }

.hv-empty--card {
  background-color: var(--surface-sunken);
  border: var(--border-hair) solid var(--border-subtle); border-radius: var(--radius-lg);
}
.hv-empty--dashed {
  background-color: var(--surface-sunken); border-radius: var(--radius-lg);
  position: relative;
}

/* O slot do icone continua existindo, e continua tendo altura FIXA \u2014 e o que
   garante que carregando e vazio tenham a mesma altura e a lista nao salte
   quando o dado chega (ver o comentario do componente). O que saiu foi o
   disco: sem preenchimento, sem contorno, sem 56px. Sobrou o glifo, na
   escala do texto e na tinta sutil, porque ele acompanha a frase \u2014 nao a
   substitui. */
.hv-empty__icon {
  display: inline-flex; align-items: center; justify-content: center;
  height: 24px; color: var(--text-subtle);
}
.hv-empty--sm .hv-empty__icon { height: 20px; }
.hv-empty--lg .hv-empty__icon { height: 28px; }
.hv-empty__icon svg, .hv-empty__icon i, .hv-empty__icon [data-lucide] { width: 20px; height: 20px; display: block; }
.hv-empty--sm .hv-empty__icon svg, .hv-empty--sm .hv-empty__icon [data-lucide] { width: 17px; height: 17px; }
.hv-empty--lg .hv-empty__icon svg, .hv-empty--lg .hv-empty__icon [data-lucide] { width: 24px; height: 24px; }

.hv-empty__copy { display: flex; flex-direction: column; gap: var(--space-2); max-width: 46ch; }
/* Titulo na familia de DISPLAY. O vazio e um dos poucos lugares onde uma
   frase curta carrega a tela inteira, e e exatamente para isso que a marca
   tem uma display com caracter. */
.hv-empty__title {
  font: var(--weight-semibold) var(--text-xl)/var(--leading-snug) var(--font-display);
  letter-spacing: var(--tracking-snug); color: var(--text-strong);
}
.hv-empty--sm .hv-empty__title { font-size: var(--text-lg); }
.hv-empty--lg .hv-empty__title { font-size: var(--text-2xl); }
.hv-empty__desc { font-size: var(--text-md); color: var(--text-muted); line-height: var(--leading-normal); text-wrap: pretty; }
.hv-empty--sm .hv-empty__desc { font-size: var(--text-sm); }

/* Ritmo: apertado DENTRO do bloco (glifo, titulo, descricao), generoso
   ENTRE o texto e a acao. Antes tudo tinha o mesmo respiro e nada dizia o
   que pertencia a que. */
.hv-empty__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
.hv-empty--center .hv-empty__actions { justify-content: center; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-empty-css")) {
  const el = document.createElement("style");
  el.id = "hv-empty-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  size = "md",
  variant = "plain",
  align = "start",
  loading = false,
  loadingLabel = "Carregando\u2026",
  className = "",
  style = {},
  ...rest
}) {
  const cls = [
    "hv-empty",
    size === "sm" ? "hv-empty--sm" : size === "lg" ? "hv-empty--lg" : "",
    variant === "card" ? "hv-empty--card" : variant === "dashed" ? "hv-empty--dashed" : "",
    align === "center" ? "hv-empty--center" : "",
    className
  ].filter(Boolean).join(" ");
  if (loading) {
    return /* @__PURE__ */ React.createElement("div", { className: cls, style, role: "status", "aria-busy": "true", ...rest }, /* @__PURE__ */ React.createElement("span", { className: "hv-empty__icon" }, /* @__PURE__ */ React.createElement(Spinner, { size: size === "lg" ? "md" : "sm", label: loadingLabel })), /* @__PURE__ */ React.createElement("span", { className: "hv-empty__copy" }, /* @__PURE__ */ React.createElement("span", { className: "hv-empty__title" }, loadingLabel), description && /* @__PURE__ */ React.createElement("span", { className: "hv-empty__desc" }, description)));
  }
  return /* @__PURE__ */ React.createElement("div", { className: cls, style, role: "status", ...rest }, icon && /* @__PURE__ */ React.createElement("span", { className: "hv-empty__icon" }, icon), /* @__PURE__ */ React.createElement("span", { className: "hv-empty__copy" }, title && /* @__PURE__ */ React.createElement("span", { className: "hv-empty__title" }, title), description && /* @__PURE__ */ React.createElement("span", { className: "hv-empty__desc" }, description)), children, (action || secondaryAction) && /* @__PURE__ */ React.createElement("span", { className: "hv-empty__actions" }, action, secondaryAction));
}
export {
  EmptyState
};
