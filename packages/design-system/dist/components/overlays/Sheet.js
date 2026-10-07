import React from "react";
import ReactDOM from "react-dom";
import { IconButton } from "../buttons/IconButton.js";
import { useSwipeDismiss, useScrollLock, useFocusTrap } from "../hooks/gestures.js";
import { resolvePortalTarget } from "../hooks/viewport.js";
import "../_scroll.js";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-sheet__scrim {
  position: fixed; inset: 0; z-index: 200;
  background: var(--scrim-sheet);
  opacity: 1; transition: opacity var(--dur-sheet) var(--ease-standard);
  -webkit-tap-highlight-color: transparent;
}
/* SAIDA \u2014 quem fecha e a pessoa, entao a saida responde ao gesto: nao fica
   mais lenta que a entrada. So troca a curva por --ease-exit. Ver secao 04. */
.hv-sheet__scrim[data-enter="false"] { opacity: 0; transition: opacity var(--dur-slow) var(--ease-exit); }

.hv-sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 201;
  display: flex; flex-direction: column;
  background: var(--surface-card);
  border-radius: var(--radius-sheet, 28px) var(--radius-sheet, 28px) 0 0;
  box-shadow: var(--shadow-xl);
  /* min() de duas restricoes: % resolve contra o BLOCO CONTENTOR (a janela num
     app, a moldura quando ha container), e dvh protege do iOS, onde a barra de
     URL muda a altura util. Uma so nao cobre os dois casos. */
  max-height: min(calc(100% - var(--space-6)), calc(100dvh - var(--safe-top, 0px) - var(--space-6)));
  font-family: var(--font-sans);
  will-change: transform;
  /* Entrada e sa\xEDda em mola; durante o arraste isto \xE9 desligado inline. */
  transition: transform var(--dur-sheet) var(--ease-spring);
  touch-action: none;
}
/* Fallback para navegador sem dvh: 100vh no iOS inclui a barra de URL, ent\xE3o
   o sheet fica alto demais \u2014 mas alto demais e recortado e melhor que nao
   abrir. */
@supports not (height: 100dvh) {
  .hv-sheet { max-height: min(calc(100% - var(--space-6)), calc(100vh - var(--safe-top, 0px) - var(--space-6))); }
}

.hv-sheet[data-enter="false"] { transform: translateY(100%); transition: transform var(--dur-slow) var(--ease-exit); }

/* Centralizado em telas grandes: o mesmo componente serve de modal no desktop
   sem precisar de um segundo componente. */
.hv-sheet[data-center="true"] {
  left: 50%; right: auto; bottom: auto; top: 50%;
  /* Porcentagem e nao vw: mesma armadilha do dvh no detent. O vw e a largura
     da JANELA, entao dentro de uma moldura de 372px o modal saia com 480px e
     transbordava pelos dois lados. A porcentagem resolve contra o bloco
     contentor. */
  width: min(480px, calc(100% - var(--space-8)));
  border-radius: var(--radius-modal, 26px);
  transform: translate(-50%, -50%);
  max-height: min(calc(100% - var(--space-8)), calc(100dvh - var(--space-10)));
}
.hv-sheet[data-center="true"][data-enter="false"] { transform: translate(-50%, calc(-50% + 16px)); opacity: 0; }
.hv-sheet[data-center="true"] { transition: transform var(--dur-normal) var(--ease-entrance), opacity var(--dur-normal) var(--ease-entrance); }

/* --- al\xE7a --- */
.hv-sheet__grabber {
  flex: none; display: flex; align-items: center; justify-content: center;
  padding: var(--space-2) 0 var(--space-1); cursor: grab; touch-action: none;
}
.hv-sheet__grabber:active { cursor: grabbing; }
.hv-sheet__grabber::before {
  content: ""; display: block;
  width: var(--sheet-grabber-w, 36px); height: var(--sheet-grabber-h, 4px);
  border-radius: var(--radius-pill); background: var(--border-strong);
}

/* --- cabe\xE7alho --- */
.hv-sheet__header {
  flex: none; display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-2) var(--space-4) var(--space-3);
}
.hv-sheet__htext { flex: 1; min-width: 0; }
.hv-sheet__title {
  font: var(--weight-semibold) var(--text-xl)/1.25 var(--font-display);
  color: var(--text-strong); letter-spacing: var(--tracking-snug); margin: 0;
}
.hv-sheet__desc {
  font: var(--text-sm)/1.45 var(--font-sans); color: var(--text-muted);
  margin: var(--nudge-3) 0 0;
}
.hv-sheet__close { flex: none; margin-top: -4px; }

/* --- corpo --- */
.hv-sheet__body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 0 var(--space-4) var(--space-4);
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

/* --- rodap\xE9 ancorado --- */
.hv-sheet__footer {
  flex: none; display: flex; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  padding-bottom: calc(var(--space-3) + var(--safe-bottom, 0));
  border-top: var(--border-hair) solid var(--border-subtle);
  background: var(--surface-card);
}
.hv-sheet__footer > * { flex: 1; }

/* Sem rodap\xE9, a safe area entra no corpo \u2014 sen\xE3o o \xFAltimo item fica embaixo do
   indicador de home. */
.hv-sheet:not([data-has-footer="true"]) .hv-sheet__body {
  padding-bottom: calc(var(--space-4) + var(--safe-bottom, 0));
}

@media (prefers-reduced-motion: reduce) {
  .hv-sheet, .hv-sheet__scrim { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-sheet-css")) {
  const el = document.createElement("style");
  el.id = "hv-sheet-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const XIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18M6 6l12 12" }));
function Sheet({
  open = false,
  onClose,
  title,
  description,
  detents = [0.9],
  detent,
  onDetentChange,
  grabber = true,
  dismissible = true,
  center = false,
  container,
  footer,
  children,
  className = "",
  ariaLabel,
  ...rest
}) {
  const [mounted, setMounted] = React.useState(open);
  const [enter, setEnter] = React.useState(false);
  const [indice, setIndice] = React.useState(() => Math.max(0, detents.length - 1));
  const painelRef = React.useRef(null);
  useFocusTrap(open, painelRef);
  const controlado = detent !== void 0;
  const atual = controlado ? detent : indice;
  const alvo = detents[Math.min(atual, detents.length - 1)] ?? 0.9;
  useScrollLock(mounted);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setEnter(false);
    const t = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(t);
  }, [open]);
  React.useEffect(() => {
    if (!mounted || !open) return;
    if (painelRef.current) void painelRef.current.getBoundingClientRect();
    setEnter(true);
  }, [mounted, open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && dismissible) onClose && onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);
  const descer = () => {
    if (atual > 0) {
      if (!controlado) setIndice(atual - 1);
      onDetentChange && onDetentChange(atual - 1);
      return;
    }
    if (dismissible) onClose && onClose();
  };
  const podeSubir = atual < detents.length - 1;
  const subir = () => {
    if (!podeSubir) return;
    if (!controlado) setIndice(atual + 1);
    onDetentChange && onDetentChange(atual + 1);
  };
  const { handlers, offset, dragging } = useSwipeDismiss({
    onDismiss: descer,
    onReverse: podeSubir ? subir : void 0,
    axis: "y",
    direction: 1,
    threshold: 88,
    enabled: !center && (dismissible || detents.length > 1)
  });
  if (!mounted) return null;
  const estilo = center ? void 0 : {
    // PORCENTAGEM, nao dvh: `dvh` e sempre relativo a JANELA, mesmo quando
    // o sheet esta dentro de um bloco contentor. Num preview de 640px um
    // detent de 0.9 virava 90% da janela — 1121px — e o painel transbordava
    // a moldura inteira. `%` resolve contra o contentor, que e a janela num
    // app de verdade e a moldura quando ha `container`.
    height: `${Math.round(alvo * 100)}%`,
    // Durante o arraste o painel acompanha o dedo sem transition: qualquer
    // interpolação aqui aparece como atraso entre o toque e o painel.
    // Nao clampa em 0: com detent maior disponivel o arraste para cima
    // tambem move o painel, e clampar deixaria o gesto sem retorno visual.
    transform: dragging || offset ? `translateY(${offset}px)` : void 0,
    transition: dragging ? "none" : void 0
  };
  const conteudo = /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "hv-sheet__scrim",
      "data-enter": enter,
      onClick: dismissible ? onClose : void 0,
      "aria-hidden": "true"
    }
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: painelRef,
      className: ["hv-sheet", className].filter(Boolean).join(" "),
      "data-enter": enter,
      "data-center": center ? "true" : void 0,
      "data-has-footer": footer ? "true" : void 0,
      style: estilo,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": ariaLabel || (typeof title === "string" ? title : void 0),
      ...rest
    },
    grabber && !center && /* @__PURE__ */ React.createElement("div", { className: "hv-sheet__grabber", ...handlers, "aria-hidden": "true" }),
    (title || description || dismissible && onClose) && /* @__PURE__ */ React.createElement("div", { className: "hv-sheet__header" }, /* @__PURE__ */ React.createElement("div", { className: "hv-sheet__htext" }, title && /* @__PURE__ */ React.createElement("h2", { className: "hv-sheet__title" }, title), description && /* @__PURE__ */ React.createElement("p", { className: "hv-sheet__desc" }, description)), dismissible && onClose && /* @__PURE__ */ React.createElement("span", { className: "hv-sheet__close" }, /* @__PURE__ */ React.createElement(IconButton, { variant: "quiet", label: "Fechar", onClick: onClose }, XIcon))),
    /* @__PURE__ */ React.createElement("div", { className: "hv-sheet__body hv-scroll" }, children),
    footer && /* @__PURE__ */ React.createElement("div", { className: "hv-sheet__footer" }, footer)
  ));
  const destino = resolvePortalTarget(container);
  return destino ? createPortal(conteudo, destino) : conteudo;
}
export {
  Sheet
};
