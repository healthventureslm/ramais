import React from "react";
import { haptics } from "../hooks/gestures.js";
import "../_scroll.js";
const CSS = `
.hv-ptr { position: relative; height: 100%; overflow: hidden; }

.hv-ptr__spinner {
  position: absolute; top: 0; left: 0; right: 0; z-index: 1;
  display: flex; align-items: flex-end; justify-content: center;
  pointer-events: none; overflow: hidden;
}
.hv-ptr__disc {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; margin-bottom: var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-card); box-shadow: var(--shadow-md);
  color: var(--text-link);
}
.hv-ptr__disc svg { width: 17px; height: 17px; display: block; }

/* Girando: vira spinner de verdade. Antes disso o icone acompanha o dedo,
   entao a pessoa ve o quanto falta em vez de so esperar. */
.hv-ptr[data-state="refreshing"] .hv-ptr__disc svg { animation: hv-spin 0.8s linear infinite; }

.hv-ptr__scroll {
  height: 100%; overflow-y: auto;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  will-change: transform;
  /* Ver SwipeActions: --dur-gesture e o tempo de retomada apos soltar. */
  transition: transform var(--dur-gesture) var(--ease-spring);
}
.hv-ptr[data-dragging="true"] .hv-ptr__scroll { transition: none; }

@media (prefers-reduced-motion: reduce) {
  .hv-ptr__scroll { transition: none; }
  .hv-ptr[data-state="refreshing"] .hv-ptr__disc svg { animation: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-ptr-css")) {
  const el = document.createElement("style");
  el.id = "hv-ptr-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ArrowIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M12 5v14M19 12l-7 7-7-7" }));
const SpinIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M21 12a9 9 0 1 1-6.2-8.6" }));
function PullToRefresh({
  onRefresh,
  threshold = 72,
  disabled = false,
  scrollRef,
  refreshingLabel = "Atualizando\u2026",
  className = "",
  children,
  ...rest
}) {
  const [pull, setPull] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const interno = React.useRef(null);
  const alvo = scrollRef || interno;
  const st = React.useRef({ ativo: false, y0: 0, x0: 0, decidiu: false, id: null, armado: false });
  const onPointerDown = (e) => {
    if (disabled || refreshing) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = alvo.current;
    if (!el || el.scrollTop > 0) return;
    const s = st.current;
    s.ativo = true;
    s.y0 = e.clientY;
    s.x0 = e.clientX;
    s.decidiu = false;
    s.id = e.pointerId;
    s.armado = false;
  };
  const onPointerMove = (e) => {
    const s = st.current;
    if (!s.ativo || e.pointerId !== s.id) return;
    const dy = e.clientY - s.y0;
    const dx = e.clientX - s.x0;
    if (!s.decidiu) {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      s.decidiu = true;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        s.ativo = false;
        return;
      }
      setDragging(true);
    }
    if (dy <= 0) {
      setPull(0);
      return;
    }
    const maximo = threshold * 2;
    const resistido = maximo * (1 - Math.exp(-dy / maximo));
    setPull(resistido);
    const armado = resistido >= threshold;
    if (armado !== s.armado) {
      if (armado) haptics(10);
      s.armado = armado;
    }
  };
  const finalizar = async () => {
    const s = st.current;
    if (!s.ativo && !dragging) return;
    const arrastou = s.decidiu;
    s.ativo = false;
    setDragging(false);
    if (!arrastou) {
      setPull(0);
      return;
    }
    if (s.armado && onRefresh) {
      haptics(12);
      setRefreshing(true);
      setPull(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
    s.armado = false;
  };
  const estado = refreshing ? "refreshing" : pull >= threshold ? "armed" : "idle";
  const progresso = Math.min(1, pull / threshold);
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-ptr", className].filter(Boolean).join(" "),
      "data-state": estado,
      "data-dragging": dragging ? "true" : void 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: finalizar,
      onPointerCancel: finalizar,
      ...rest
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-ptr__spinner", style: { height: `${pull}px` }, "aria-hidden": !refreshing }, /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "hv-ptr__disc",
        style: {
          opacity: Math.min(1, progresso * 1.4),
          // Gira acompanhando o dedo antes de virar spinner: mostra o quanto
          // falta em vez de so pedir para esperar.
          transform: refreshing ? void 0 : `rotate(${progresso * 180}deg)`
        },
        role: refreshing ? "status" : void 0,
        "aria-label": refreshing ? refreshingLabel : void 0
      },
      refreshing ? SpinIcon : ArrowIcon
    )),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: scrollRef ? void 0 : interno,
        className: "hv-ptr__scroll hv-scroll",
        style: { transform: pull ? `translateY(${pull}px)` : void 0 }
      },
      children
    )
  );
}
export {
  PullToRefresh
};
