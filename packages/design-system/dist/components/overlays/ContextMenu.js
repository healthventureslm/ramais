import React from "react";
import ReactDOM from "react-dom";
import { haptics } from "../hooks/gestures.js";
import { resolvePortalTarget } from "../hooks/viewport.js";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-ctxmenu__scrim {
  position: fixed; inset: 0; z-index: 210;
  background: var(--scrim-menu);
  opacity: 1; transition: opacity var(--dur-normal) var(--ease-standard);
}
/* SAIDA \u2014 quem fecha e a pessoa, entao a saida responde ao gesto: nao fica
   mais lenta que a entrada. So troca a curva por --ease-exit. Ver secao 04. */
.hv-ctxmenu__scrim[data-enter="false"] { opacity: 0; transition-timing-function: var(--ease-exit); }

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  @media (prefers-reduced-transparency: no-preference) {
    .hv-ctxmenu__scrim {
      -webkit-backdrop-filter: blur(var(--glass-blur-deep, 40px));
      backdrop-filter: blur(var(--glass-blur-deep, 40px));
    }
  }
}

.hv-ctxmenu__stage {
  position: fixed; z-index: 211;
  display: flex; flex-direction: column; gap: var(--space-2);
  pointer-events: none;
}

/* O item erguido: mesma coisa que estava na lista, so que destacada. */
.hv-ctxmenu__lift {
  pointer-events: auto;
  border-radius: var(--radius-card-m, 20px);
  background: var(--surface-card);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transform-origin: center;
  transition: transform var(--dur-normal) var(--ease-spring),
              opacity var(--dur-fast) var(--ease-standard);
}
.hv-ctxmenu__stage[data-enter="false"] .hv-ctxmenu__lift { transform: scale(0.96); opacity: 0;
  transition: transform var(--dur-fast) var(--ease-exit), opacity var(--dur-fast) var(--ease-exit); }

.hv-ctxmenu__list {
  pointer-events: auto;
  min-width: 220px; max-width: min(320px, calc(100vw - var(--space-8)));
  border-radius: var(--radius-card-m, 20px);
  background: var(--surface-card);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transform-origin: top center;
  transition: transform var(--dur-normal) var(--ease-spring),
              opacity var(--dur-fast) var(--ease-standard);
}
.hv-ctxmenu__stage[data-enter="false"] .hv-ctxmenu__list { transform: scale(0.9); opacity: 0;
  transition: transform var(--dur-fast) var(--ease-exit), opacity var(--dur-fast) var(--ease-exit); }

.hv-ctxmenu__item {
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%; min-height: var(--tap-comfort, 48px);
  padding: var(--space-2) var(--space-4);
  border: none; background: transparent; cursor: pointer; text-align: left;
  font: var(--weight-medium) var(--text-md)/1.3 var(--font-sans);
  color: var(--text-body);
  border-top: var(--border-hair) solid var(--border-subtle);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background-color var(--dur-fast) var(--ease-standard);
}
.hv-ctxmenu__item:first-child { border-top: none; }
.hv-ctxmenu__item:active { background: var(--state-press); }
.hv-ctxmenu__item:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
/* Par desenhado, nao opacidade. Aqui o DS controla a cor de TODO o texto, que e
   a condicao que a isencao de opacidade nao cobre.

   Medido (claro, sobre --surface-card): --state-disabled-fg da 3,10:1 sempre.
   O opacity 0.5 dava de 2,26 a 3,28 no MESMO componente, porque o resultado
   depende da cor de partida \u2014 texto que comecava em --text-muted caia mais que
   texto que comecava em --text-strong. O ganho aqui e previsibilidade, nao
   contraste: nenhum dos dois alcanca 4,5, e o teto de qualquer opacity 0.5 e
   3,98 (preto puro). Ver a nota de contraste no DESIGN.md. */
.hv-ctxmenu__item[disabled] { color: var(--state-disabled-fg); cursor: not-allowed; }
.hv-ctxmenu__item[data-danger="true"] { color: var(--danger-fg); }
.hv-ctxmenu__icon { flex: none; display: inline-flex; color: var(--text-subtle); }
.hv-ctxmenu__item[data-danger="true"] .hv-ctxmenu__icon { color: var(--danger-fg); }
.hv-ctxmenu__icon svg { width: 19px; height: 19px; display: block; }

/* NAO use display: contents aqui: elemento com contents nao tem caixa, e
   getBoundingClientRect devolveria zero \u2014 o palco abriria no canto da tela.
   O wrapper precisa medir o item que envolve. */
.hv-ctxmenu__trigger { display: block; }

@media (prefers-reduced-motion: reduce) {
  .hv-ctxmenu__lift, .hv-ctxmenu__list, .hv-ctxmenu__scrim { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-ctxmenu-css")) {
  const el = document.createElement("style");
  el.id = "hv-ctxmenu-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function ContextMenu({
  items = [],
  delay = 450,
  disabled = false,
  showPreview = true,
  container,
  onOpenChange,
  className = "",
  children,
  ...rest
}) {
  const [aberto, setAberto] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [caixa, setCaixa] = React.useState(null);
  const trigRef = React.useRef(null);
  const timer = React.useRef(null);
  const st = React.useRef({ x: 0, y: 0, abriu: false });
  const fechar = React.useCallback(() => {
    setEnter(false);
    setTimeout(() => {
      setAberto(false);
      setCaixa(null);
    }, 220);
    onOpenChange && onOpenChange(false);
  }, [onOpenChange]);
  const abrir = React.useCallback(() => {
    const el = trigRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCaixa({ top: r.top, left: r.left, width: r.width, height: r.height });
    setAberto(true);
    st.current.abriu = true;
    haptics(12);
    onOpenChange && onOpenChange(true);
  }, [onOpenChange]);
  React.useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(() => setEnter(true), 10);
    const onKey = (e) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto, fechar]);
  const cancelar = () => {
    clearTimeout(timer.current);
  };
  const onPointerDown = (e) => {
    if (disabled || !items.length) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    st.current = { x: e.clientX, y: e.clientY, abriu: false };
    clearTimeout(timer.current);
    timer.current = setTimeout(abrir, delay);
  };
  const onPointerMove = (e) => {
    if (Math.abs(e.clientX - st.current.x) > 8 || Math.abs(e.clientY - st.current.y) > 8) {
      cancelar();
    }
  };
  const onContextMenu = (e) => {
    if (disabled || !items.length) return;
    e.preventDefault();
    abrir();
  };
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
    if (!aberto) return;
    const id = setTimeout(() => {
      const primeiro = listaRef.current && listaRef.current.querySelector("button:not(:disabled)");
      primeiro && primeiro.focus();
    }, 60);
    return () => clearTimeout(id);
  }, [aberto]);
  const acionar = (item) => {
    if (item.disabled) return;
    fechar();
    item.onSelect && item.onSelect(item.id);
  };
  let estiloPalco = null;
  if (caixa) {
    const alturaMenu = Math.min(items.length * 48 + 16, 320);
    const espacoAbaixo = window.innerHeight - (caixa.top + caixa.height);
    const cabeAbaixo = espacoAbaixo > alturaMenu + 24;
    estiloPalco = cabeAbaixo ? {
      top: caixa.top,
      left: Math.max(12, Math.min(caixa.left, window.innerWidth - caixa.width - 12)),
      width: caixa.width,
      alignItems: "stretch"
    } : {
      bottom: window.innerHeight - (caixa.top + caixa.height),
      left: Math.max(12, Math.min(caixa.left, window.innerWidth - caixa.width - 12)),
      width: caixa.width,
      alignItems: "stretch",
      flexDirection: "column-reverse"
    };
  }
  const overlay = aberto && caixa && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "hv-ctxmenu__scrim", "data-enter": enter, onClick: fechar, "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("div", { className: "hv-ctxmenu__stage", "data-enter": enter, style: estiloPalco, role: "menu" }, showPreview && /* @__PURE__ */ React.createElement("div", { className: "hv-ctxmenu__lift", "aria-hidden": "true" }, children), /* @__PURE__ */ React.createElement("div", { className: "hv-ctxmenu__list", ref: listaRef, onKeyDown: navegarPorSeta }, items.map((item, i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: item.id || i,
      type: "button",
      role: "menuitem",
      className: "hv-ctxmenu__item",
      "data-danger": item.danger ? "true" : void 0,
      disabled: item.disabled,
      onClick: () => acionar(item)
    },
    item.icon && /* @__PURE__ */ React.createElement("span", { className: "hv-ctxmenu__icon", "aria-hidden": "true" }, item.icon),
    /* @__PURE__ */ React.createElement("span", null, item.label)
  )))));
  const destino = resolvePortalTarget(container);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: trigRef,
      className: ["hv-ctxmenu__trigger", className].filter(Boolean).join(" "),
      onPointerDown,
      onPointerMove,
      onPointerUp: cancelar,
      onPointerCancel: cancelar,
      onContextMenu,
      ...rest
    },
    children
  ), overlay && destino ? createPortal(overlay, destino) : overlay);
}
export {
  ContextMenu
};
