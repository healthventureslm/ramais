import React from "react";
const CSS = `
.hv-iconbtn {
  --_bg: transparent; --_bg-hover: var(--state-hover); --_bg-press: var(--state-press);
  --_fg: var(--text-body); --_bd: transparent;
  /* Desabilitado por PAPEL, nao por opacidade: opacity desbota o glifo
     junto com o fundo e no escuro o resultado e sujeira, nao "apagado". */
  --_bg-off: transparent;
  --_fg-off: var(--state-disabled-fg);
  --_bd-off: transparent;
  --_ring: var(--shadow-focus);
  --_ico: 20px;
  --_stroke: 2;
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
  border: var(--border-thick) solid var(--_bd); background: var(--_bg);
  color: var(--_fg); border-radius: var(--radius-md); cursor: pointer;
  /* Tempo por ESTADO. A base e a SAIDA: acende rapido, apaga devagar.
     box-shadow fica de fora \u2014 anel de foco nao anima. */
  transition: background-color var(--dur-normal) var(--ease-standard),
              color var(--dur-normal) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard);
  /* No iOS, sem isto: retangulo cinza no toque e 300ms de espera para
     descartar o duplo-toque de zoom. */
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
/* data-inactive cobre <button> e <a> com o mesmo seletor \u2014 <a> nao
   entende :disabled. */
.hv-iconbtn:not([data-inactive]):hover {
  background: var(--_bg-hover);
  transition-duration: var(--dur-fast);
}
.hv-iconbtn:not([data-inactive]):active {
  background: var(--_bg-press);
  transition-duration: 0s;
}
.hv-iconbtn:focus-visible { outline: none; box-shadow: var(--_ring); }

/* No ponteiro fino o passo de cor ja e o retorno do press. No toque nao
   existe hover antecedendo, entao a escala e o unico sinal antes do dedo
   sair \u2014 e num alvo pequeno ela precisa ser mais funda que a do Button. */
@media (pointer: coarse) {
  .hv-iconbtn:not([data-inactive]):active { transform: scale(0.94); }
}
.hv-iconbtn[data-inactive] {
  background: var(--_bg-off); color: var(--_fg-off);
  border-color: var(--_bd-off); cursor: not-allowed;
}
/* px inteiro, nao em: 1.2em dava 20.4px no md e 18px no sm, e tamanho
   fracionario borra traco de 2px em tela nao-retina. Mesma convencao do
   Tag, do Checkbox e do Combobox. */
.hv-iconbtn svg { width: var(--_ico); height: var(--_ico); stroke-width: var(--_stroke); display: block; }

.hv-iconbtn--sm { width: 32px; height: 32px; --_ico: 18px; --_stroke: 2.25; }
.hv-iconbtn--md { width: 40px; height: 40px; --_ico: 20px; --_stroke: 2; }
.hv-iconbtn--lg { width: 48px; height: 48px; --_ico: 24px; --_stroke: 2; }

/* Dedo: 32 e 40px ficam abaixo do --tap-min que o resto do DS respeita.
   O glifo NAO cresce junto (font-size fica) \u2014 quem cresce e o alvo. */
@media (pointer: coarse) {
  .hv-iconbtn--sm, .hv-iconbtn--md { width: var(--tap-min); height: var(--tap-min); }
}

.hv-iconbtn--solid {
  --_bg: var(--action-primary); --_bg-hover: var(--action-primary-hover);
  --_bg-press: var(--action-primary-press); --_fg: var(--action-primary-text);
  --_bg-off: var(--state-disabled-bg);
}
.hv-iconbtn--outline {
  --_bg: var(--surface-card); --_bg-hover: var(--state-hover);
  --_bg-press: var(--state-press); --_fg: var(--text-strong); --_bd: var(--border-control);
  --_bg-off: var(--surface-card); --_bd-off: var(--state-disabled-bd);
}
.hv-iconbtn--ghost {
  --_bg: transparent; --_bg-hover: var(--petrol-50);
  --_bg-press: var(--petrol-100); --_fg: var(--petrol-700);
}
.hv-iconbtn--danger {
  --_bg: transparent; --_bg-hover: var(--danger-hover);
  --_bg-press: var(--danger-subtle); --_fg: var(--danger-fg);
  --_ring: var(--shadow-focus-danger);
}

/* Sobre superf\xEDcie de marca (sidebar petrol, NavBar variant="brand"), onde
   os tokens de texto normais ficariam ileg\xEDveis. Mesmo padr\xE3o do
   .hv-spinner--on-brand. Combina com qualquer variante. */
.hv-iconbtn--on-brand {
  --_fg: var(--text-on-brand);
  --_bg-hover: var(--veil-hover);
  --_bg-press: var(--veil-press);
  --_ring: var(--shadow-focus-on-brand);
  --_fg-off: var(--veil-fg-off);
}

@media (prefers-reduced-motion: reduce) {
  /* A cor pode continuar mudando: o que incomoda e a GEOMETRIA. */
  .hv-iconbtn {
    transition: background-color var(--dur-fast) linear,
                color var(--dur-fast) linear;
  }
  .hv-iconbtn:not([data-inactive]):active { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-iconbtn-css")) {
  const el = document.createElement("style");
  el.id = "hv-iconbtn-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const IconButton = React.forwardRef(function IconButton2({
  variant = "quiet",
  size = "md",
  label,
  onBrand = false,
  disabled = false,
  href,
  className = "",
  onClick,
  children,
  ...rest
}, ref) {
  const cls = [
    "hv-iconbtn",
    `hv-iconbtn--${variant}`,
    `hv-iconbtn--${size}`,
    onBrand ? "hv-iconbtn--on-brand" : "",
    className
  ].filter(Boolean).join(" ");
  const ehLink = Boolean(href);
  const Tag = ehLink ? "a" : "button";
  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) onClick(e);
  };
  return /* @__PURE__ */ React.createElement(
    Tag,
    {
      ref,
      className: cls,
      "data-inactive": disabled ? "" : void 0,
      href: ehLink && !disabled ? href : void 0,
      tabIndex: ehLink && disabled ? 0 : void 0,
      type: ehLink ? void 0 : "button",
      disabled: !ehLink && disabled ? true : void 0,
      "aria-disabled": ehLink && disabled ? true : void 0,
      "aria-label": label,
      title: label,
      onClick: handleClick,
      ...rest
    },
    children
  );
});
export {
  IconButton
};
