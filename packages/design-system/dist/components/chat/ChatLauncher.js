import React from "react";
const CSS = `
.hv-chatbtn { position: relative; display: inline-flex; align-items: center; gap: 9px; border: none; cursor: pointer;
  font-family: var(--font-sans); font-weight: var(--weight-semibold); background: var(--action-primary); color: var(--action-primary-text);
  border-radius: var(--radius-pill); box-shadow: var(--shadow-lg);
  transition: background-color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard); }
/* Sem translateY no hover: o botao que levita e o mesmo tell que saiu do Card
   e do StatCard. O degrau de tom + sombra ja diz "isto responde". E o press
   zera a transicao (Regra do press), senao o scale some num fade. */
.hv-chatbtn:hover { background: var(--action-primary-hover); box-shadow: var(--shadow-xl); }
.hv-chatbtn:active { background: var(--action-primary-press); transform: scale(0.96); transition-duration: 0s; }
.hv-chatbtn:focus-visible { outline: none; box-shadow: var(--shadow-focus), var(--shadow-lg); }
.hv-chatbtn svg { width: 24px; height: 24px; display: block; }

.hv-chatbtn--icon { width: 56px; height: 56px; justify-content: center; padding: 0; border-radius: 50%; }
.hv-chatbtn--label { height: 52px; padding: 0 22px 0 18px; font-size: var(--text-sm); }
.hv-chatbtn--sm.hv-chatbtn--icon { width: 44px; height: 44px; }
.hv-chatbtn--sm svg { width: 20px; height: 20px; }

.hv-chatbtn--fixed { position: fixed; z-index: 70; bottom: 24px; }
.hv-chatbtn--bottom-right { right: 24px; }
.hv-chatbtn--bottom-left { left: 24px; }

.hv-chatbtn__badge { position: absolute; top: -3px; right: -3px; min-width: 20px; height: 20px; box-sizing: border-box;
  /* Era --coral-500. Mensagem nao lida nao e processo vivo, entao vai no
     acento, como o Indicator. O badge fica quase todo FORA do botao, sobre o
     canvas, e o anel de canvas o separa do petrol do botao \u2014 testado em luz
     (branco) antes, e branco sobre areia sumia. */
  padding: 0 5px; border-radius: var(--radius-pill); background: var(--action-primary); color: var(--action-primary-text);
  font: var(--weight-bold) 11px/20px var(--font-mono); text-align: center; box-shadow: 0 0 0 2px var(--surface-canvas); }
.hv-chatbtn__badge:empty { min-width: 12px; width: 12px; height: 12px; padding: 0; }

@media (prefers-reduced-motion: reduce) {
  .hv-chatbtn:hover, .hv-chatbtn:active { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-chatbtn-css")) {
  const el = document.createElement("style");
  el.id = "hv-chatbtn-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props });
const ChatIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
const CloseIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18" }), /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12" }));
function ChatLauncher({
  onClick,
  open = false,
  label,
  unread,
  icon,
  size = "md",
  position = "bottom-right",
  openLabel = "Abrir chat",
  closeLabel = "Fechar chat",
  className = "",
  ...rest
}) {
  const fixed = position === "bottom-right" || position === "bottom-left";
  const cls = [
    "hv-chatbtn",
    label ? "hv-chatbtn--label" : "hv-chatbtn--icon",
    size === "sm" ? "hv-chatbtn--sm" : "",
    fixed ? "hv-chatbtn--fixed" : "",
    fixed ? `hv-chatbtn--${position}` : "",
    className
  ].filter(Boolean).join(" ");
  const ic = icon !== void 0 ? icon : open ? CloseIcon : ChatIcon;
  const showBadge = !open && unread != null && unread !== false && unread !== 0;
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: cls,
      onClick,
      "aria-label": typeof label === "string" ? label : open ? closeLabel : openLabel,
      "aria-expanded": open,
      ...rest
    },
    ic,
    label && /* @__PURE__ */ React.createElement("span", null, label),
    showBadge && /* @__PURE__ */ React.createElement("span", { className: "hv-chatbtn__badge" }, unread === true ? "" : unread)
  );
}
export {
  ChatLauncher
};
