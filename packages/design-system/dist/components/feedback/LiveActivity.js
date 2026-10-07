import React from "react";
import ReactDOM from "react-dom";
import { resolvePortalTarget } from "../hooks/viewport.js";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-liveact__wrap {
  position: fixed; left: 0; right: 0; z-index: 90;
  display: flex; justify-content: center;
  padding: 0 var(--space-4);
  pointer-events: none;
}
.hv-liveact__wrap[data-anchor="bottom"] {
  bottom: calc(var(--tabbar-height, 0px) + var(--safe-bottom, 0px) + var(--space-2));
}
.hv-liveact__wrap[data-anchor="top"] {
  top: calc(var(--safe-top, 0px) + var(--space-2));
}

.hv-liveact {
  pointer-events: auto; position: relative;
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%; max-width: 480px;
  min-height: var(--live-pill-height, 44px);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-pill);
  background: var(--surface-card);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-sans); text-align: left;
  touch-action: manipulation;
  transition: transform var(--dur-normal) var(--ease-spring),
              opacity var(--dur-fast) var(--ease-standard);
}
.hv-liveact[data-enter="false"] { opacity: 0; transform: translateY(12px) scale(0.96); }
/* SAIDA \u2014 some sozinho, entao apaga devagar (DESIGN.md, secao 04).
   Em CSS a transicao usa a regra do estado de DESTINO: esta vale so quando o
   componente vai para fechado; a entrada continua na regra base. E troca a
   mola, que passa do ponto, por --ease-exit: nada deve quicar enquanto some. */
.hv-liveact[data-enter="false"] { transition-duration: var(--dur-slow); transition-timing-function: var(--ease-exit); }
.hv-liveact__wrap[data-anchor="top"] .hv-liveact[data-enter="false"] { transform: translateY(-12px) scale(0.96); }
.hv-liveact:has(button.hv-liveact__body:active) { transform: scale(0.985); }

/* Era inset 3px 0 0 \u2014 a aba lateral pela terceira vez no sistema, e aqui a
   pior das tres: sobre --radius-pill o inset de 3px e recortado por um canto
   de 22px e sobra uma lasca de poucos pixels na lateral. Nao le como fio, le
   como falha de render.

   O anel faz o que o fio tentava fazer e mais: acompanha a forma inteira e
   soma com a --shadow-lg em vez de brigar com ela. E e o --shadow-live, o
   token que o DESIGN.md chama de impressao digital do sistema e que ate aqui
   nao tinha um unico consumidor \u2014 a assinatura estava declarada e desligada.

   O fundo continua neutro: elemento que fica permanentemente na tela nao pode
   carregar tinta. Quem carrega o tom agora e o anel e o pulso \u2014 --live-tone
   alimenta os dois: um tom, dois lugares.

   O anel e redeclarado por tom em vez de sair parametrizado da raiz porque
   custom property com var() dentro e substituida no elemento ONDE E
   DECLARADA: --shadow-live computa na :root e desce ja resolvido, entao um
   override de tom no filho nao teria efeito nenhum. */
.hv-liveact { --live-tone: var(--live); --_ring: var(--shadow-live);
  box-shadow: var(--_ring), var(--shadow-lg); }
.hv-liveact[data-tone="brand"]    { --live-tone: var(--action-primary); }
.hv-liveact[data-tone="positive"] { --live-tone: var(--positive-fg); }
.hv-liveact[data-tone="warning"]  { --live-tone: var(--warning-fg); }
.hv-liveact[data-tone="brand"], .hv-liveact[data-tone="positive"], .hv-liveact[data-tone="warning"] {
  --_ring: 0 0 0 4px color-mix(in srgb, var(--live-tone) 18%, transparent);
}

.hv-liveact__pulse {
  flex: none; width: 10px; height: 10px; border-radius: 50%;
  animation: hv-pulse-live 2s var(--ease-standard) infinite;
}
/* O pulso le o mesmo --live-tone do anel: um tom, dois lugares, uma linha. */
.hv-liveact__pulse { background: var(--live-tone); }

/* O corpo e que e o alvo de toque, NAO a pilula inteira. Fazer o container
   virar <button> aninharia os botoes de acao dentro dele \u2014 <button> dentro de
   <button> e HTML invalido, o navegador reestrutura o DOM e o clique da acao
   deixa de chegar. Mesmo padrao do ListItem com acoes. */
.hv-liveact__body {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  border: none; background: transparent; padding: 0; text-align: left;
  font: inherit; color: inherit; min-height: var(--tap-min, 44px);
  justify-content: center;
}
button.hv-liveact__body { cursor: pointer; -webkit-tap-highlight-color: transparent; }
button.hv-liveact__body:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-tap); }
.hv-liveact__label {
  font: var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);
  color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hv-liveact__meta {
  font: var(--text-sm)/1.3 var(--font-mono); color: var(--text-muted);
  margin-top: var(--nudge-1);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.hv-liveact__slot { flex: none; display: inline-flex; align-items: center; gap: var(--space-1); }

@media (prefers-reduced-motion: reduce) {
  .hv-liveact { transition: opacity var(--dur-fast) linear; }
  .hv-liveact[data-enter="false"] { transform: none; }
  .hv-liveact__pulse { animation: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-liveact-css")) {
  const el = document.createElement("style");
  el.id = "hv-liveact-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function formatDuration(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const ss = s % 60;
  const dd = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dd(m)}:${dd(ss)}` : `${dd(m)}:${dd(ss)}`;
}
function LiveActivity({
  open = false,
  label,
  meta,
  /**
   * Instante em que o processo começou. Com ele o componente conta o tempo
   * sozinho — que é o que faz a pílula parecer viva. Sem ele, use `meta`.
   */
  startedAt,
  tone = "live",
  anchor = "bottom",
  actions,
  onClick,
  ariaLabel,
  container,
  className = "",
  ...rest
}) {
  const [mounted, setMounted] = React.useState(open);
  const [enter, setEnter] = React.useState(false);
  const [agora, setAgora] = React.useState(() => Date.now());
  const ref = React.useRef(null);
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
    if (!open || startedAt == null) return;
    const id = setInterval(() => setAgora(Date.now()), 1e3);
    return () => clearInterval(id);
  }, [open, startedAt]);
  if (!mounted) return null;
  const decorrido = startedAt != null ? formatDuration((agora - new Date(startedAt).getTime()) / 1e3) : null;
  const linhaMeta = decorrido && meta ? `${decorrido} \xB7 ${meta}` : decorrido || meta;
  const Corpo = onClick ? "button" : "div";
  const conteudo = /* @__PURE__ */ React.createElement("div", { className: "hv-liveact__wrap", "data-anchor": anchor }, /* @__PURE__ */ React.createElement(
    "div",
    {
      ref,
      className: ["hv-liveact", className].filter(Boolean).join(" "),
      "data-enter": enter,
      "data-tone": tone !== "live" ? tone : void 0,
      role: "status",
      "aria-live": "polite",
      ...rest
    },
    /* @__PURE__ */ React.createElement("span", { className: "hv-liveact__pulse", "aria-hidden": "true" }),
    /* @__PURE__ */ React.createElement(
      Corpo,
      {
        className: "hv-liveact__body",
        type: onClick ? "button" : void 0,
        onClick,
        "aria-label": ariaLabel
      },
      /* @__PURE__ */ React.createElement("span", { className: "hv-liveact__label" }, label),
      linhaMeta && /* @__PURE__ */ React.createElement("span", { className: "hv-liveact__meta", "aria-hidden": "true" }, linhaMeta)
    ),
    actions && /* @__PURE__ */ React.createElement("span", { className: "hv-liveact__slot" }, actions)
  ));
  const destino = resolvePortalTarget(container);
  return destino ? createPortal(conteudo, destino) : conteudo;
}
export {
  LiveActivity,
  formatDuration
};
