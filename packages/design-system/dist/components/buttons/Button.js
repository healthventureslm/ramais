import React from "react";
const CSS = `
.hv-btn {
  --_bg: var(--action-primary);
  --_bg-hover: var(--action-primary-hover);
  --_bg-press: var(--action-primary-press);
  --_fg: var(--action-primary-text);
  --_bd: transparent;
  /* Desabilitado por PAPEL, nao por opacidade. Cada variante reescreve o
     que muda: um ghost desabilitado nao pode ganhar preenchimento que ele
     nao tem quando esta ativo. */
  --_bg-off: var(--state-disabled-bg);
  --_fg-off: var(--state-disabled-fg);
  --_bd-off: transparent;
  /* O anel de foco acompanha a NATUREZA da acao, nao a marca. */
  --_ring: var(--shadow-focus);
  /* Altura, respiro e glifo saem do tamanho, nao da variante. */
  --_h: 40px;
  --_pad: var(--space-4);
  --_ico: 18px;
  --_stroke: 2;
  /* Empilha conteudo e spinner na MESMA celula: assim o carregamento nao
     muda a largura do botao (ver .hv-btn__spinner). */
  display: inline-grid; grid-template-columns: 1fr;
  align-items: center; justify-items: center;
  box-sizing: border-box;
  height: var(--_h); padding: 0 var(--_pad);
  font-family: var(--font-sans); font-weight: var(--weight-semibold);
  line-height: 1; white-space: nowrap; text-decoration: none;
  border: var(--border-thick) solid var(--_bd);
  background: var(--_bg); color: var(--_fg);
  border-radius: var(--radius-md); cursor: pointer;
  /* Tempo por ESTADO, nao um valor unico para tudo.
     A base e a SAIDA: acende rapido, apaga devagar \u2014 e disso que vem a
     sensacao de material em vez de troca de classe. A entrada acelera no
     :hover e o press zera (abaixo).
     box-shadow ficou de fora de proposito: o anel de foco nao anima.
     Anel que faz fade desorienta quem navega por teclado. */
  transition: background-color var(--dur-normal) var(--ease-standard),
              border-color var(--dur-normal) var(--ease-standard),
              color var(--dur-normal) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard);
  user-select: none;
  /* Sem isto o iOS pinta um retangulo cinza no toque e espera 300ms para
     decidir se foi duplo-toque de zoom. O DS ja fazia isso em Fab, TabBar,
     ListItem e Tag \u2014 o botao base era o unico que faltava. */
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* data-inactive cobre <button> e <a> com o mesmo seletor: <a> nao entende
   :disabled, e o estado ocupado nao usa o atributo (ver o .jsx). */
.hv-btn:not([data-inactive]):hover {
  background: var(--_bg-hover);
  transition-duration: var(--dur-fast);   /* entrada mais rapida que a saida */
}
.hv-btn:not([data-inactive]):active {
  background: var(--_bg-press);
  transition-duration: 0s;   /* press com fade parece travado */
}
.hv-btn:focus-visible { outline: none; box-shadow: var(--_ring); }

/* O press NAO encolhe o botao no ponteiro fino: um scale uniforme e um
   tremor num botao block de 300px e invisivel num de 60px, e o passo de
   cor ja e o sinal. No toque nao existe hover antecedendo o press \u2014 la a
   escala e o unico retorno antes do dedo sair. */
@media (pointer: coarse) {
  .hv-btn:not([data-inactive]):active { transform: scale(0.97); }
}

.hv-btn[data-inactive="off"] {
  background: var(--_bg-off); color: var(--_fg-off);
  border-color: var(--_bd-off); cursor: not-allowed;
}
/* Ocupado NAO e desabilitado: a acao existe, ja foi aceita e esta correndo.
   O botao mantem a propria cor \u2014 desbota-lo aqui diria "indisponivel". */
.hv-btn[data-inactive="busy"] { cursor: progress; }

/* sizes \u2014 o lg ganhava 8px de altura e 1px de texto, entao o rotulo se
   perdia no ar. text-lg (17px) e o corpo que uma caixa de 48px pede. */
.hv-btn--sm { --_h: 32px; --_pad: var(--space-3); --_ico: 16px; --_stroke: 2.25; font-size: var(--text-sm); }
.hv-btn--md { --_h: 40px; --_pad: var(--space-4); --_ico: 18px; --_stroke: 2;    font-size: var(--text-md); }
.hv-btn--lg { --_h: 48px; --_pad: var(--space-6); --_ico: 20px; --_stroke: 2;    font-size: var(--text-lg); }

/* Dedo: 32 e 40px estao abaixo do --tap-min que o resto do DS respeita
   (ListItem, Tag, Snackbar, InsertDivider). Cresce so onde ha ponteiro
   grosso \u2014 no mouse a densidade da tela continua a mesma. */
@media (pointer: coarse) {
  .hv-btn--sm, .hv-btn--md { --_h: var(--tap-min); }
}

/* Ajuste optico: glifo nao tem sidebearing como letra, entao o lado com
   icone precisa de menos respiro ou o botao fica visivelmente torto. Os
   tokens --nudge-* existem no DS exatamente para isto. */
.hv-btn[data-icon~="left"]  { padding-left:  calc(var(--_pad) - var(--nudge-2)); }
.hv-btn[data-icon~="right"] { padding-right: calc(var(--_pad) - var(--nudge-2)); }

/* variants */
.hv-btn--secondary {
  --_bg: var(--surface-card); --_bg-hover: var(--state-hover); --_bg-press: var(--state-press);
  --_fg: var(--text-strong); --_bd: var(--border-control);
  --_bg-off: var(--surface-card); --_bd-off: var(--state-disabled-bd);
}
.hv-btn--ghost {
  --_bg: transparent; --_bg-hover: var(--petrol-50); --_bg-press: var(--petrol-100);
  --_fg: var(--petrol-700); --_bd: transparent;
  --_bg-off: transparent;
}
.hv-btn--danger {
  --_bg: var(--action-danger); --_bg-hover: var(--action-danger-hover);
  --_bg-press: var(--action-danger-press); --_fg: var(--action-danger-text);
  --_ring: var(--shadow-focus-danger);
}
.hv-btn--quiet {
  --_bg: transparent; --_bg-hover: var(--state-hover); --_bg-press: var(--state-press);
  --_fg: var(--text-body); --_bd: transparent;
  --_bg-off: transparent;
}

/* Largura total: aqui o rotulo PODE quebrar. nowrap com 100% de largura
   estoura a frase para fora do botao em tela estreita \u2014 e um botao que
   ocupa a linha inteira ja nao depende de caber numa linha para nao
   parecer defeito, que e o motivo do nowrap no inline. */
.hv-btn--block {
  width: 100%;
  height: auto; min-height: var(--_h);
  padding-block: var(--space-2);
  white-space: normal; text-wrap: balance;
}
/* line-height 1 existe para centrar UMA linha na caixa. Assim que o rotulo
   quebra ele vira texto, e texto com entrelinha 1 gruda. */
.hv-btn--block .hv-btn__content { text-align: center; line-height: var(--leading-snug); }

/* Sobre superficie de marca (SidebarNav, NavBar variant="brand"), onde os
   tokens de texto normais ficam ilegiveis. Mesmo padrao do IconButton e do
   Spinner. Depois das variantes de proposito: combina com qualquer uma, e
   com peso igual quem vem por ultimo vence. Pensado para quiet/ghost \u2014
   um preenchimento petrol sobre chrome petrol nao se distingue do fundo. */
.hv-btn--on-brand {
  --_fg: var(--text-on-brand);
  --_bg-hover: var(--veil-hover);
  --_bg-press: var(--veil-press);
  --_ring: var(--shadow-focus-on-brand);
  --_fg-off: var(--veil-fg-off);
  --_bd-off: transparent;
}

.hv-btn__content {
  grid-area: 1 / 1;
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2);
  transition: opacity var(--dur-fast) var(--ease-standard);
}
/* O rotulo tambem e uma linha flex, e isso NAO e redundancia.
   Quem passa o icone como CHILDREN em vez de iconLeft poe o svg dentro
   deste span. Se o produto tiver um reset com svg{display:block} \u2014 e
   o preflight do Tailwind tem \u2014 um svg bloco dentro de um span inline
   quebra a linha, e o icone sobe para cima do texto. Como flex, o svg vira
   item da linha e senta ao lado, qualquer que seja o display dele.
   Mesma licao do ListItem em 1.24.1: empilhar (ou nao) nao pode depender
   do display que cada filho calha de ter. */
.hv-btn__content > span {
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-width: 0;
}
/* O conteudo nao sai do fluxo: some por opacidade e SEGURA a largura de
   repouso. Antes o spinner era inserido e o botao crescia 1em + gap no
   meio do clique. Continua no arvore de acessibilidade de proposito \u2014
   e dele que vem o nome do botao, e aria-busy diz o resto. */
.hv-btn[data-inactive="busy"] .hv-btn__content { opacity: 0; }

.hv-btn__spinner {
  grid-area: 1 / 1;
  width: 1em; height: 1em; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: hv-spin 0.7s linear infinite;
}
.hv-btn__ico { display: inline-flex; }
/* px inteiro, nao em: 1.15em dava 16.1px no md e 14.95px no sm, e tamanho
   fracionario borra traco de 2px em tela nao-retina. Mesma convencao do
   Tag, do Checkbox e do Combobox. */
.hv-btn__ico svg { width: var(--_ico); height: var(--_ico); stroke-width: var(--_stroke); display: block; }

@media (prefers-reduced-motion: reduce) {
  /* Cor pode continuar: o que incomoda quem pediu menos movimento e a
     GEOMETRIA mudando. */
  .hv-btn {
    transition: background-color var(--dur-fast) linear,
                border-color var(--dur-fast) linear,
                color var(--dur-fast) linear;
  }
  .hv-btn:not([data-inactive]):active { transform: none; }
  .hv-btn__spinner { animation-duration: 1.4s; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-button-css")) {
  const el = document.createElement("style");
  el.id = "hv-button-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Button = React.forwardRef(function Button2({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  disabled = false,
  onBrand = false,
  iconLeft = null,
  iconRight = null,
  href,
  type = "button",
  className = "",
  onClick,
  children,
  ...rest
}, ref) {
  const cls = [
    "hv-btn",
    `hv-btn--${variant}`,
    `hv-btn--${size}`,
    block ? "hv-btn--block" : "",
    onBrand ? "hv-btn--on-brand" : "",
    className
  ].filter(Boolean).join(" ");
  const ehLink = Boolean(href);
  const Tag = ehLink ? "a" : "button";
  const bloqueado = disabled || loading;
  const lados = [iconLeft ? "left" : "", iconRight ? "right" : ""].filter(Boolean).join(" ");
  const handleClick = (e) => {
    if (bloqueado) {
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
      "data-inactive": disabled ? "off" : loading ? "busy" : void 0,
      "data-icon": lados || void 0,
      href: ehLink && !bloqueado ? href : void 0,
      tabIndex: ehLink && bloqueado ? 0 : void 0,
      type: ehLink ? void 0 : type,
      disabled: !ehLink && disabled ? true : void 0,
      "aria-disabled": ehLink && bloqueado || loading ? true : void 0,
      "aria-busy": loading || void 0,
      onClick: handleClick,
      ...rest
    },
    /* @__PURE__ */ React.createElement("span", { className: "hv-btn__content" }, iconLeft && /* @__PURE__ */ React.createElement("span", { className: "hv-btn__ico" }, iconLeft), children && /* @__PURE__ */ React.createElement("span", null, children), iconRight && /* @__PURE__ */ React.createElement("span", { className: "hv-btn__ico" }, iconRight)),
    loading && /* @__PURE__ */ React.createElement("span", { className: "hv-btn__spinner", "aria-hidden": "true" })
  );
});
export {
  Button
};
