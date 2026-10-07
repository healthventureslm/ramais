import React from "react";
import { haptics } from "../hooks/gestures.js";
const CSS = `
.hv-swipe { position: relative; overflow: hidden; touch-action: pan-y; }

.hv-swipe__actions {
  position: absolute; top: 0; bottom: 0; display: flex; align-items: stretch;
}
.hv-swipe__actions[data-side="end"]   { right: 0; }
.hv-swipe__actions[data-side="start"] { left: 0; }

.hv-swipe__action {
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--nudge-3);
  min-width: 76px; padding: 0 var(--space-3);
  border: none; cursor: pointer;
  background: var(--surface-sunken); color: var(--text-body);
  font: var(--weight-semibold) var(--text-2xs)/1.1 var(--font-sans);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.hv-swipe__action svg { width: 20px; height: 20px; display: block; }
.hv-swipe__action:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -3px; }

.hv-swipe__action[data-tone="danger"]   { background: var(--crimson-600); color: var(--action-danger-text); }
.hv-swipe__action[data-tone="positive"] { background: var(--emerald-600); color: var(--text-on-accent); }
.hv-swipe__action[data-tone="warning"]  { background: var(--amber-500);   color: var(--text-on-accent); }
.hv-swipe__action[data-tone="brand"]    { background: var(--action-primary); color: var(--action-primary-text); }

.hv-swipe__content {
  position: relative; z-index: 1;
  background: var(--surface-card);
  will-change: transform;
  /* --dur-gesture existia em mobile.css e nunca era usado: foi criado
     exatamente para a RETOMADA depois de soltar o dedo, que e mais lenta que
     uma troca de estado comum. A mola precisa desse tempo a mais para
     assentar sem parecer que travou. */
  transition: transform var(--dur-gesture) var(--ease-spring);
}

/* Passou do ponto de disparo: a primeira acao ocupa a faixa toda, sinalizando
   que soltar agora ja executa. */
.hv-swipe[data-armed="true"] .hv-swipe__actions .hv-swipe__action:first-child { flex: 1; }

@media (prefers-reduced-motion: reduce) {
  .hv-swipe__content { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-swipe-css")) {
  const el = document.createElement("style");
  el.id = "hv-swipe-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function SwipeActions({
  actions = [],
  side = "end",
  fullSwipe = true,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [armed, setArmed] = React.useState(false);
  const painelRef = React.useRef(null);
  const st = React.useRef({ ativo: false, x0: 0, y0: 0, base: 0, decidiu: false, id: null });
  const sinal = side === "end" ? -1 : 1;
  const largura = () => painelRef.current ? painelRef.current.offsetWidth : 0;
  const disparo = () => Math.max(largura() * 1.6, 160);
  const fechar = () => {
    setOffset(0);
    setArmed(false);
  };
  const aberta = offset !== 0;
  const onPointerDown = (e) => {
    if (disabled || !actions.length) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = st.current;
    s.ativo = true;
    s.x0 = e.clientX;
    s.y0 = e.clientY;
    s.base = offset;
    s.decidiu = false;
    s.id = e.pointerId;
  };
  const onPointerMove = (e) => {
    const s = st.current;
    if (!s.ativo || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.decidiu) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.decidiu = true;
      if (Math.abs(dy) > Math.abs(dx)) {
        s.ativo = false;
        return;
      }
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(s.id);
      } catch (err) {
      }
    }
    let proximo = s.base + dx;
    if (proximo * sinal < 0) proximo = proximo / 4;
    const abertura = Math.abs(proximo);
    setOffset(proximo);
    const armar = fullSwipe && abertura > disparo();
    if (armar !== armed) {
      if (armar) haptics(10);
      setArmed(armar);
    }
  };
  const finalizar = (e) => {
    const s = st.current;
    if (!s.ativo && !dragging) return;
    const arrastou = s.decidiu;
    s.ativo = false;
    setDragging(false);
    if (!arrastou) return;
    const abertura = Math.abs(offset);
    if (armed && actions[0]) {
      haptics(12);
      fechar();
      actions[0].onSelect && actions[0].onSelect(actions[0].id);
    } else if (abertura > largura() / 2) {
      setOffset(largura() * sinal);
      setArmed(false);
    } else {
      fechar();
    }
    try {
      e && e.currentTarget && e.currentTarget.releasePointerCapture(s.id);
    } catch (err) {
    }
  };
  const acionar = (acao) => {
    fechar();
    acao.onSelect && acao.onSelect(acao.id);
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-swipe", className].filter(Boolean).join(" "),
      "data-armed": armed ? "true" : void 0,
      ...rest
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-swipe__actions", "data-side": side, ref: painelRef }, actions.map((a, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: a.id || i,
        type: "button",
        className: "hv-swipe__action",
        "data-tone": a.tone,
        onClick: () => acionar(a),
        "aria-label": a.label,
        tabIndex: aberta ? void 0 : -1,
        "aria-hidden": aberta ? void 0 : "true"
      },
      a.icon,
      a.label && /* @__PURE__ */ React.createElement("span", null, a.label)
    ))),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "hv-swipe__content",
        style: {
          transform: offset ? `translateX(${offset}px)` : void 0,
          transition: dragging ? "none" : void 0
        },
        onPointerDown,
        onPointerMove,
        onPointerUp: finalizar,
        onPointerCancel: finalizar
      },
      children
    )
  );
}
export {
  SwipeActions
};
