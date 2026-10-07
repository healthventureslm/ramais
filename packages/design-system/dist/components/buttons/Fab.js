import React from "react";
const CSS = `
.hv-fab {
  --_ring: var(--shadow-focus);
  position: fixed; z-index: 80;
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2);
  min-width: var(--fab-size, 56px); height: var(--fab-size, 56px);
  padding: 0; border: none; border-radius: var(--radius-pill);
  background: var(--action-primary); color: var(--action-primary-text);
  box-shadow: var(--shadow-lg); cursor: pointer;
  font: var(--weight-semibold) var(--text-md)/1 var(--font-sans);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: transform var(--dur-normal) var(--ease-spring),
              background-color var(--dur-fast) var(--ease-standard),
              opacity var(--dur-fast) var(--ease-standard);
}
.hv-fab[data-position="absolute"] { position: absolute; }
.hv-fab[data-position="static"]   { position: relative; }

/* Ancoragem: soma a tab bar sozinha. Num produto sem barra o token nao
   existe e o Fab encosta no rodape. */
.hv-fab[data-corner="end"] {
  right: calc(var(--safe-right, 0px) + var(--space-4));
  bottom: calc(var(--tabbar-height, 0px) + var(--safe-bottom, 0px) + var(--space-4));
}
.hv-fab[data-corner="start"] {
  left: calc(var(--safe-left, 0px) + var(--space-4));
  bottom: calc(var(--tabbar-height, 0px) + var(--safe-bottom, 0px) + var(--space-4));
}
.hv-fab[data-corner="center"] {
  left: 50%; transform: translateX(-50%);
  bottom: calc(var(--tabbar-height, 0px) + var(--safe-bottom, 0px) + var(--space-4));
}

.hv-fab:active { transform: scale(0.94); }
.hv-fab[data-corner="center"]:active { transform: translateX(-50%) scale(0.94); }
.hv-fab:focus-visible { outline: none; box-shadow: var(--_ring), var(--shadow-lg); }
/* Desabilitado por PAPEL: opacity desbotava o glifo junto com o
   preenchimento, e uma acao primaria a 45% sobre canvas claro ficava perto
   demais de "ausente". A forma continua inteira, so a energia sai. */
.hv-fab:disabled {
  background: var(--state-disabled-bg); color: var(--state-disabled-fg);
  box-shadow: none; cursor: not-allowed;
}

/* Estendido: icone + rotulo. Use quando a acao nao e obvia pelo icone \u2014
   um icone sozinho so funciona quando ninguem precisa adivinhar. */
.hv-fab--extended { padding: 0 var(--space-5); }
.hv-fab svg { width: 24px; height: 24px; display: block; }

.hv-fab--secondary {
  background: var(--surface-card); color: var(--text-strong);
  box-shadow: inset 0 0 0 1px var(--border-default), var(--shadow-lg);
}
.hv-fab--live {
  background: var(--live); color: var(--text-on-accent);
  /* Anel petrol em volta de coral e a unica peca da tela discordando da
     cor da acao. O anel segue a natureza do botao. */
  --_ring: var(--shadow-focus-live);
}

/* Some ao rolar para baixo, junto com a tab bar. */
.hv-fab[data-hidden="true"] { opacity: 0; transform: scale(0.8); pointer-events: none; }
.hv-fab[data-corner="center"][data-hidden="true"] { transform: translateX(-50%) scale(0.8); }

@media (prefers-reduced-motion: reduce) {
  .hv-fab { transition: opacity var(--dur-fast) linear; }
  .hv-fab:active { transform: none; }
  .hv-fab[data-corner="center"]:active { transform: translateX(-50%); }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-fab-css")) {
  const el = document.createElement("style");
  el.id = "hv-fab-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Fab = React.forwardRef(function Fab2({
  label,
  icon,
  extended = false,
  variant = "primary",
  corner = "end",
  position = "fixed",
  hideOnScroll = false,
  scrollRef = null,
  onClick,
  disabled = false,
  className = "",
  ...rest
}, ref) {
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    if (!hideOnScroll) {
      setHidden(false);
      return;
    }
    const target = scrollRef && scrollRef.current ? scrollRef.current : null;
    const node = target || (typeof window !== "undefined" ? window : null);
    if (!node) return;
    const read = () => target ? target.scrollTop : window.scrollY;
    let last = read();
    const onScroll = () => {
      const now = read();
      const delta = now - last;
      if (Math.abs(delta) < 8) return;
      setHidden(now > 56 && delta > 0);
      last = now;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [hideOnScroll, scrollRef]);
  const mostraRotulo = extended && label;
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ref,
      type: "button",
      className: [
        "hv-fab",
        variant !== "primary" ? `hv-fab--${variant}` : "",
        mostraRotulo ? "hv-fab--extended" : "",
        className
      ].filter(Boolean).join(" "),
      "data-corner": corner,
      "data-position": position,
      "data-hidden": hidden ? "true" : void 0,
      "aria-label": label,
      onClick,
      disabled,
      ...rest
    },
    icon,
    mostraRotulo && /* @__PURE__ */ React.createElement("span", null, label)
  );
});
export {
  Fab
};
