import React from "react";
import ReactDOM from "react-dom";
import { resolvePortalTarget } from "../hooks/viewport.js";
import { Button } from "../buttons/Button.js";
import { Spinner } from "./Spinner.js";
import { formatDuration } from "./LiveActivity.js";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-recdock__wrap {
  position: fixed; left: 0; right: 0; z-index: 90;
  display: flex; justify-content: center;
  padding: 0 var(--space-4);
  bottom: calc(var(--tabbar-height, 0px) + var(--safe-bottom, 0px) + var(--space-4));
  pointer-events: none;
}
.hv-recdock {
  pointer-events: auto; position: relative;
  container-type: inline-size;
  width: 100%; max-width: 640px;
  border-radius: var(--radius-lg);
  background: var(--surface-float);
  font-family: var(--font-sans);
  --_ring: 0 0 0 0 transparent;
  box-shadow: var(--_ring), var(--shadow-lg);
  transition: transform var(--dur-normal) var(--ease-spring),
              opacity var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-normal) var(--ease-standard);
}
.hv-recdock[data-enter="false"] { opacity: 0; transform: translateY(12px) scale(0.97); }
/* Sai sozinho quando a captura termina: apaga devagar e sem mola (DESIGN.md 04). */
.hv-recdock[data-enter="false"] { transition-duration: var(--dur-slow); transition-timing-function: var(--ease-exit); }

/* O tom fica no ANEL, nunca no fundo: \xE9 uma pe\xE7a que pode ficar minutos na
   tela, por cima de qualquer conte\xFAdo. S\xF3 dois estados pedem anel \u2014 o que est\xE1
   vivo (a assinatura --shadow-live) e o que est\xE1 em risco (\xE1udio n\xE3o enviado). */
.hv-recdock[data-phase="recording"] { --_ring: var(--shadow-live); }
.hv-recdock[data-phase="failed"] { --_ring: 0 0 0 4px color-mix(in srgb, var(--danger-fg) 18%, transparent); }

.hv-recdock__in {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
}

.hv-recdock__status { flex: none; width: 20px; display: inline-flex; align-items: center; justify-content: center; }
.hv-recdock__pulse {
  width: 10px; height: 10px; border-radius: 50%; background: var(--live);
  animation: hv-pulse-live 2s var(--ease-standard) infinite;
}
.hv-recdock__status svg { width: 18px; height: 18px; display: block; }
.hv-recdock[data-phase="paused"] .hv-recdock__status { color: var(--warning-fg); }
.hv-recdock[data-phase="failed"] .hv-recdock__status { color: var(--danger-fg); }

.hv-recdock__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--nudge-1); }
.hv-recdock__title {
  font: var(--weight-semibold) var(--text-md)/1.25 var(--font-sans); color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hv-recdock__meta {
  font: var(--text-sm)/1.35 var(--font-sans); color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hv-recdock__time { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--text-body); }
.hv-recdock[data-phase="recording"] .hv-recdock__time { color: var(--text-strong); }

.hv-recdock__actions { flex: none; display: flex; align-items: center; gap: var(--space-2); }

/* Estreito (celular, painel lateral): as a\xE7\xF5es secund\xE1rias perdem o r\xF3tulo e
   ficam no glifo \u2014 o nome continua no aria-label. Finalizar e Reenviar
   mant\xEAm o texto: s\xE3o as duas decis\xF5es que n\xE3o podem ser adivinhadas. */
@container (max-width: 520px) {
  .hv-recdock__txt--opt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
}
/* Mais estreito que isso, o t\xEDtulo virava "Con\u2026". As a\xE7\xF5es descem para uma
   segunda linha e o texto fica com a largura inteira: saber QUAL consulta
   est\xE1 gravando vale mais que a altura economizada. */
@container (max-width: 420px) {
  .hv-recdock__in { flex-wrap: wrap; row-gap: var(--space-2); }
  .hv-recdock__body { flex-basis: calc(100% - 20px - var(--space-3)); }
  .hv-recdock__actions { flex-basis: 100%; justify-content: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .hv-recdock { transition: opacity var(--dur-fast) linear; }
  .hv-recdock[data-enter="false"] { transform: none; }
  .hv-recdock__pulse { animation: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-recdock-css")) {
  const el = document.createElement("style");
  el.id = "hv-recdock-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Glifo = ({ children, fill }) => /* @__PURE__ */ React.createElement(
  "svg",
  {
    viewBox: "0 0 24 24",
    fill: fill ? "currentColor" : "none",
    stroke: fill ? "none" : "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  },
  children
);
const PauseIcon = () => /* @__PURE__ */ React.createElement(Glifo, { fill: true }, /* @__PURE__ */ React.createElement("path", { d: "M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" }));
const PlayIcon = () => /* @__PURE__ */ React.createElement(Glifo, { fill: true }, /* @__PURE__ */ React.createElement("path", { d: "M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" }));
const StopIcon = () => /* @__PURE__ */ React.createElement(Glifo, { fill: true }, /* @__PURE__ */ React.createElement("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2" }));
const RetryIcon = () => /* @__PURE__ */ React.createElement(Glifo, null, /* @__PURE__ */ React.createElement("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }), /* @__PURE__ */ React.createElement("path", { d: "M3 3v5h5" }));
const OpenIcon = () => /* @__PURE__ */ React.createElement(Glifo, null, /* @__PURE__ */ React.createElement("path", { d: "m9 18 6-6-6-6" }));
const AlertIcon = () => /* @__PURE__ */ React.createElement(Glifo, null, /* @__PURE__ */ React.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), /* @__PURE__ */ React.createElement("path", { d: "M12 9v4M12 17h.01" }));
function RecordingDock({
  phase = "idle",
  /** O que está sendo capturado — "Consulta · Maria Silva". */
  title,
  /** Segundos gravados. Controlado: quem grava sabe quando o relógio parou. */
  elapsed = 0,
  /** Teto da captura, quando existe. Vira "12:04 de 60:00". */
  limit,
  /** Linha de apoio. Em `failed`, diga o que está guardado e o que fazer. */
  meta,
  onPause,
  onResume,
  onStop,
  onRetry,
  onOpen,
  recordingLabel = "Gravando",
  pausedLabel = "Pausado",
  sendingLabel = "Enviando e transcrevendo\u2026",
  failedLabel = "Grava\xE7\xE3o n\xE3o enviada",
  pauseLabel = "Pausar",
  resumeLabel = "Retomar",
  stopLabel = "Finalizar",
  retryLabel = "Reenviar",
  openLabel = "Abrir",
  limitSeparator = "de",
  container,
  className = "",
  ...rest
}) {
  const open = phase !== "idle";
  const [mounted, setMounted] = React.useState(open);
  const [enter, setEnter] = React.useState(false);
  const [visivel, setVisivel] = React.useState(phase);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      setVisivel(phase);
      return;
    }
    setEnter(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open, phase]);
  React.useEffect(() => {
    if (!mounted || !open) return;
    if (ref.current) void ref.current.getBoundingClientRect();
    setEnter(true);
  }, [mounted, open]);
  if (!mounted) return null;
  const f = visivel;
  const aoVivo = f === "recording" || f === "paused";
  const tempo = aoVivo && /* @__PURE__ */ React.createElement("span", { className: "hv-recdock__time" }, formatDuration(elapsed), limit != null && ` ${limitSeparator} ${formatDuration(limit)}`);
  let principal, apoio, status;
  if (aoVivo) {
    principal = title;
    apoio = /* @__PURE__ */ React.createElement(React.Fragment, null, f === "recording" ? recordingLabel : pausedLabel, " \xB7 ", tempo, meta && /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 ", meta));
    status = f === "recording" ? /* @__PURE__ */ React.createElement("span", { className: "hv-recdock__pulse" }) : /* @__PURE__ */ React.createElement(PauseIcon, null);
  } else if (f === "sending") {
    principal = sendingLabel;
    apoio = meta || title;
    status = /* @__PURE__ */ React.createElement(Spinner, { size: "sm", label: sendingLabel });
  } else {
    principal = failedLabel;
    apoio = meta || title;
    status = /* @__PURE__ */ React.createElement(AlertIcon, null);
  }
  const acao = (rotulo, icone, handler, variant, opcional) => handler && /* @__PURE__ */ React.createElement(Button, { size: "sm", variant, iconLeft: icone, onClick: handler, "aria-label": rotulo }, /* @__PURE__ */ React.createElement("span", { className: opcional ? "hv-recdock__txt--opt" : void 0 }, rotulo));
  const conteudo = /* @__PURE__ */ React.createElement("div", { className: "hv-recdock__wrap" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      ref,
      className: ["hv-recdock", className].filter(Boolean).join(" "),
      "data-phase": f,
      "data-enter": enter,
      role: "status",
      "aria-live": "polite",
      ...rest
    },
    /* @__PURE__ */ React.createElement("div", { className: "hv-recdock__in" }, /* @__PURE__ */ React.createElement("span", { className: "hv-recdock__status", "aria-hidden": f !== "sending" || void 0 }, status), /* @__PURE__ */ React.createElement("div", { className: "hv-recdock__body" }, /* @__PURE__ */ React.createElement("span", { className: "hv-recdock__title" }, principal), apoio && /* @__PURE__ */ React.createElement("span", { className: "hv-recdock__meta", "aria-hidden": aoVivo || void 0 }, apoio)), /* @__PURE__ */ React.createElement("div", { className: "hv-recdock__actions" }, f === "recording" && acao(pauseLabel, /* @__PURE__ */ React.createElement(PauseIcon, null), onPause, "quiet", true), f === "paused" && acao(resumeLabel, /* @__PURE__ */ React.createElement(PlayIcon, null), onResume, "quiet", true), aoVivo && acao(stopLabel, /* @__PURE__ */ React.createElement(StopIcon, null), onStop, "primary", false), f === "failed" && acao(retryLabel, /* @__PURE__ */ React.createElement(RetryIcon, null), onRetry, "primary", false), acao(openLabel, /* @__PURE__ */ React.createElement(OpenIcon, null), onOpen, "secondary", true)))
  ));
  const destino = resolvePortalTarget(container);
  return destino ? createPortal(conteudo, destino) : conteudo;
}
export {
  RecordingDock
};
