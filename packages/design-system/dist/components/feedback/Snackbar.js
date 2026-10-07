import React from "react";
import ReactDOM from "react-dom";
import { useSwipeDismiss } from "../hooks/gestures.js";
import { resolvePortalTarget } from "../hooks/viewport.js";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-snackbar__wrap {
  position: fixed; left: 0; right: 0; z-index: 180;
  display: flex; flex-direction: column; align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  padding-bottom: calc(var(--space-4) + var(--safe-bottom, 0));
  pointer-events: none;
}
/* Ancoragem: acima da tab bar quando ela existe, no rodap\xE9 quando n\xE3o. */
.hv-snackbar__wrap[data-anchor="bottom"] { bottom: 0; }
.hv-snackbar__wrap[data-anchor="above-tabbar"] {
  bottom: calc(var(--tabbar-height, 0px) + var(--safe-bottom, 0px));
  padding-bottom: var(--space-3);
}
.hv-snackbar__wrap[data-anchor="top"] {
  top: 0; bottom: auto;
  padding-top: calc(var(--space-4) + var(--safe-top, 0));
  padding-bottom: 0;
  flex-direction: column-reverse;
}

.hv-snackbar {
  pointer-events: auto;
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%; max-width: 520px;
  min-height: var(--tap-comfort, 48px);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-radius: var(--radius-card-m, 20px);
  background: var(--surface-inverse, var(--ink-900));
  /* --text-on-inverse, nao --surface-card: no escuro o card e escuro e o
     texto sumiria sobre a propria superficie (medido: 1.15:1). */
  color: var(--text-on-inverse);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-sans);
  will-change: transform, opacity;
  transition: transform var(--dur-normal) var(--ease-spring),
              opacity var(--dur-fast) var(--ease-standard);
  touch-action: none;
}
.hv-snackbar[data-enter="false"] { opacity: 0; transform: translateY(16px) scale(0.97); }
/* SAIDA \u2014 some sozinho, entao apaga devagar (DESIGN.md, secao 04).
   Em CSS a transicao usa a regra do estado de DESTINO: esta vale so quando o
   componente vai para fechado; a entrada continua na regra base. E troca a
   mola, que passa do ponto, por --ease-exit: nada deve quicar enquanto some. */
.hv-snackbar[data-enter="false"] { transition-duration: var(--dur-slow); transition-timing-function: var(--ease-exit); }
.hv-snackbar__wrap[data-anchor="top"] .hv-snackbar[data-enter="false"] { transform: translateY(-16px) scale(0.97); }

.hv-snackbar__icon { flex: none; display: inline-flex; }
.hv-snackbar__icon svg { width: 19px; height: 19px; display: block; }
.hv-snackbar__text { flex: 1; min-width: 0; font: var(--text-md)/1.4 var(--font-sans); }
/* Era opacity: 0.78 \u2014 tom por transparencia, a mesma falha que o Banner tinha.
   color-mix com a propria superficie mantem o controle da cor final. */
.hv-snackbar__desc { display: block; font-size: var(--text-sm); margin-top: var(--nudge-2);
  color: color-mix(in srgb, var(--text-on-inverse) 78%, var(--surface-inverse, var(--ink-900))); }

.hv-snackbar__action {
  flex: none; border: none; background: transparent; cursor: pointer;
  min-height: var(--tap-min, 44px); box-sizing: border-box;
  padding: 0 var(--space-3);
  border-radius: var(--radius-tap, 14px);
  font: var(--weight-semibold) var(--text-md)/1 var(--font-sans);
  color: var(--petrol-300);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background-color var(--dur-fast) var(--ease-standard);
}
.hv-snackbar__action:active { background: var(--veil-press); }
.hv-snackbar__action:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }

/* Tons semanticos. O diagnostico do comentario antigo estava certo \u2014 "nao
   depender so da cor de fundo, que num snackbar escuro fica sutil demais" \u2014 e a
   resposta e que estava errada: um inset de 4px num raio de 20px e recortado
   ate virar uma lasca, e era a aba lateral pela sexta vez no sistema.

   Aqui a superficie e INVERSA (ink-900), entao tinta nao aparece: escurecer o
   escuro nao le. O instrumento e luz \u2014 o mesmo anel do LiveActivity, que e o
   outro elemento flutuante do sistema. Duas pecas que flutuam, um dispositivo
   so, em vez de duas barras escritas de jeitos diferentes.

   E o glifo passa a carregar o tom junto, para o sinal nao depender de uma
   unica coisa. */
.hv-snackbar[data-tone] { box-shadow: 0 0 0 2px color-mix(in srgb, var(--_tom) 55%, transparent), var(--shadow-lg); }
.hv-snackbar[data-tone] .hv-snackbar__icon { color: var(--_tom); }
.hv-snackbar[data-tone="positive"] { --_tom: var(--positive-border); }
.hv-snackbar[data-tone="warning"]  { --_tom: var(--warning-border); }
.hv-snackbar[data-tone="danger"]   { --_tom: var(--danger-border); }
.hv-snackbar[data-tone="live"]     { --_tom: var(--live); }

@media (prefers-reduced-motion: reduce) {
  .hv-snackbar { transition: opacity var(--dur-fast) linear; }
  .hv-snackbar[data-enter="false"] { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-snackbar-css")) {
  const el = document.createElement("style");
  el.id = "hv-snackbar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Snackbar({
  open = false,
  onClose,
  message,
  description,
  icon,
  tone = "neutral",
  action,
  actionLabel,
  onAction,
  duration = 5e3,
  anchor = "bottom",
  dismissible = true,
  container,
  className = "",
  ...rest
}) {
  const [mounted, setMounted] = React.useState(open);
  const [enter, setEnter] = React.useState(false);
  const ref = React.useRef(null);
  const timer = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setEnter(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);
  React.useEffect(() => {
    if (!mounted || !open) return;
    if (ref.current) void ref.current.getBoundingClientRect();
    setEnter(true);
  }, [mounted, open]);
  React.useEffect(() => {
    clearTimeout(timer.current);
    if (!open || !duration) return;
    timer.current = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(timer.current);
  }, [open, duration, onClose]);
  const { handlers, offset, dragging } = useSwipeDismiss({
    onDismiss: () => dismissible && onClose && onClose(),
    axis: "y",
    direction: anchor === "top" ? -1 : 1,
    threshold: 48,
    enabled: dismissible
  });
  if (!mounted) return null;
  const rotulo = actionLabel || (typeof action === "string" ? action : null);
  const conteudo = /* @__PURE__ */ React.createElement("div", { className: "hv-snackbar__wrap", "data-anchor": anchor }, /* @__PURE__ */ React.createElement(
    "div",
    {
      ref,
      className: ["hv-snackbar", className].filter(Boolean).join(" "),
      "data-enter": enter,
      "data-tone": tone !== "neutral" ? tone : void 0,
      role: "status",
      "aria-live": "polite",
      style: offset || dragging ? { transform: `translateY(${offset}px)`, transition: dragging ? "none" : void 0 } : void 0,
      ...handlers,
      ...rest
    },
    icon && /* @__PURE__ */ React.createElement("span", { className: "hv-snackbar__icon", "aria-hidden": "true" }, icon),
    /* @__PURE__ */ React.createElement("span", { className: "hv-snackbar__text" }, message, description && /* @__PURE__ */ React.createElement("span", { className: "hv-snackbar__desc" }, description)),
    rotulo && /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-snackbar__action",
        onClick: () => {
          onAction && onAction();
          onClose && onClose();
        }
      },
      rotulo
    )
  ));
  const destino = resolvePortalTarget(container);
  return destino ? createPortal(conteudo, destino) : conteudo;
}
export {
  Snackbar
};
