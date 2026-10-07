import React from "react";
const CSS = `
/* Era o trio: fundo tingido + fio de 1px em volta + border-left de 4px.

   Tres mecanismos de enfase empilhados no mesmo elemento, e o de 4px e a aba
   lateral colorida \u2014 a QUARTA ocorrencia dela no sistema, e a mais grossa das
   quatro. Sobra o fundo tingido, que ja diz "isto e uma faixa semantica", mais
   o fio, que agora da a volta inteira e respeita o raio nos quatro cantos.

   A tinta vinha de degrau de rampa (--emerald-500, --amber-500...) escrita a
   mao. O mapeamento com os pares semanticos e 1:1 EXATO \u2014 --positive-border JA
   e --emerald-500 \u2014 entao a migracao nao mexe um pixel. Vale registrar o que
   isso significa: --positive-border, --warning-border, --danger-border e
   --info-border apareciam como "tokens sem consumidor" nas varreduras, e a
   leitura de que eram superficie de API estava errada. Eles tinham um
   consumidor obvio bem aqui, que os contornava. */
.hv-banner {
  --_accent: var(--info-border);
  --_bg: var(--info-bg);
  --_fg: var(--info-fg);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: var(--border-hair) solid color-mix(in srgb, var(--_accent) 34%, var(--_bg));
  background: var(--_bg);
  color: var(--_fg);
  font-family: var(--font-sans);
}

/* A variante canonica agora e positive \u2014 o mesmo nome do par semantico
   (--positive-fg/-bg/-border). Era success: o mesmo papel com dois nomes, o
   tell de vocabulario aplicado a API. success continua aceito como apelido,
   normalizado no JSX, entao nada quebra. */
.hv-banner[data-variant="positive"] { --_accent: var(--positive-border); --_bg: var(--positive-bg); --_fg: var(--positive-fg); }
.hv-banner[data-variant="warning"] { --_accent: var(--warning-border);  --_bg: var(--warning-bg);  --_fg: var(--warning-fg); }
.hv-banner[data-variant="danger"]  { --_accent: var(--danger-border);   --_bg: var(--danger-bg);   --_fg: var(--danger-fg); }

.hv-banner__icon { flex: none; display: inline-flex; color: var(--_accent); margin-top: 1px; }
.hv-banner__icon svg { width: 20px; height: 20px; display: block; }

.hv-banner__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hv-banner__title { font-size: var(--text-md); font-weight: 600; line-height: var(--leading-snug); color: var(--_fg); }
/* Era opacity: 0.92, depois color-mix 88% com o fundo do banner. As duas
   suavizavam a MESMA tinta que ja e o par -fg/-bg medido: 88% dava 3,8:1 no
   claro. A hierarquia titulo/descricao vem do peso e do tamanho, nao de
   desbotar o texto que explica o aviso. */
.hv-banner__desc { font-size: var(--text-sm); line-height: var(--leading-normal);
  color: var(--_fg); }
.hv-banner__content { margin-top: var(--space-2); font-size: var(--text-sm); line-height: var(--leading-normal); color: var(--_fg); }

.hv-banner__meta { flex: none; align-self: center; display: inline-flex; align-items: center; gap: var(--space-1); margin-left: var(--space-2); }
.hv-banner__actions { flex: none; align-self: center; display: flex; align-items: center; gap: var(--space-2); margin-left: var(--space-2); }

.hv-banner__close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -2px -6px -2px 0;
  border: none;
  background: transparent;
  color: var(--_fg);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-colors);
}
/* O x tambem saiu da opacidade: em repouso ele e o proprio --_fg suavizado,
   e no hover volta a tinta cheia. Mexer no tom, nao na transparencia. */
.hv-banner__close { color: color-mix(in srgb, var(--_fg) 72%, var(--_bg)); }
.hv-banner__close:hover { color: var(--_fg); background: color-mix(in srgb, var(--_accent) 16%, transparent); }
.hv-banner__close:active { background: color-mix(in srgb, var(--_accent) 28%, transparent); transition-duration: 0s; }
.hv-banner__close:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-banner__close svg { width: 16px; height: 16px; display: block; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-banner-css")) {
  const el = document.createElement("style");
  el.id = "hv-banner-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement(
  "svg",
  {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    ...props
  }
);
const ICONS = {
  info: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M12 16v-4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 8h.01" })),
  positive: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), /* @__PURE__ */ React.createElement("path", { d: "m9 11 3 3L22 4" })),
  warning: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), /* @__PURE__ */ React.createElement("path", { d: "M12 9v4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 17h.01" })),
  danger: /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" }), /* @__PURE__ */ React.createElement("path", { d: "m15 9-6 6" }), /* @__PURE__ */ React.createElement("path", { d: "m9 9 6 6" }))
};
const CLOSE_ICON = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18" }), /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12" }));
function Banner({
  variant = "info",
  title,
  description,
  icon,
  meta,
  actions,
  onClose,
  role,
  className = "",
  children,
  ...rest
}) {
  const v = variant === "critical" ? "danger" : variant === "success" ? "positive" : variant;
  const computedRole = role || (v === "danger" || v === "warning" ? "alert" : "status");
  const ehComponente = (x) => typeof x === "function" || x !== null && typeof x === "object" && "$$typeof" in x && !React.isValidElement(x);
  const iconNode = icon === void 0 ? ICONS[v] : ehComponente(icon) ? React.createElement(icon) : icon;
  const cls = ["hv-banner", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { className: cls, "data-variant": v, role: computedRole, ...rest }, iconNode && /* @__PURE__ */ React.createElement("span", { className: "hv-banner__icon" }, iconNode), /* @__PURE__ */ React.createElement("div", { className: "hv-banner__body" }, title != null && /* @__PURE__ */ React.createElement("div", { className: "hv-banner__title" }, title), description != null && /* @__PURE__ */ React.createElement("div", { className: "hv-banner__desc" }, description), children != null && /* @__PURE__ */ React.createElement("div", { className: "hv-banner__content" }, children)), meta != null && /* @__PURE__ */ React.createElement("div", { className: "hv-banner__meta" }, meta), actions && /* @__PURE__ */ React.createElement("div", { className: "hv-banner__actions" }, actions), onClose && /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-banner__close", "aria-label": "Fechar", onClick: onClose }, CLOSE_ICON));
}
export {
  Banner
};
