import React from "react";
const CSS = `
/* --- grupo --- */
.hv-listgroup {
  background: var(--surface-card);
  border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-family: var(--font-sans);
}
.hv-listgroup__label {
  font: var(--weight-semibold) var(--text-2xs)/1 var(--font-sans);
  letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--text-muted);
  padding: 0 var(--space-3) var(--space-2);
}
.hv-listgroup--plain { background: transparent; border: none; border-radius: 0; }

/* --- linha --- */
.hv-listitem {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  min-height: var(--tap-comfort);
  border-bottom: var(--border-hair) solid var(--border-subtle);
  font-family: var(--font-sans); text-align: left; width: 100%;
  background: transparent; border-left: none; border-right: none; border-top: none;
  color: inherit; min-width: 0;
}
.hv-listgroup > .hv-listitem:last-child,
.hv-listitem:last-child { border-bottom: none; }

.hv-listitem--interactive {
  cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background-color var(--dur-fast) var(--ease-standard);
}
.hv-listitem--interactive:hover { background: var(--state-hover); }
.hv-listitem--interactive:active { background: var(--state-press); }
.hv-listitem--interactive:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
.hv-listitem[aria-disabled="true"] { opacity: var(--opacity-disabled); pointer-events: none; }
.hv-listitem[aria-current="true"] { background: var(--surface-brand-soft); }

.hv-listitem__media { flex: none; display: inline-flex; align-items: center; }
/* Coluna, nao bloco: title e sub sao <span>, e num container de bloco eles
   fluem INLINE \u2014 "Temperatura36,5 \xB0C" na mesma linha. Foi assim que a 1.21.0
   saiu. Flex column empilha sem depender do display de cada filho. */
.hv-listitem__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.hv-listitem__title {
  font: var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);
  color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hv-listitem__sub {
  font: var(--text-sm)/1.4 var(--font-sans); color: var(--text-muted);
  margin-top: var(--nudge-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Dado cl\xEDnico em mono: vitais, MRN, leito. */
.hv-listitem__sub--data { font-family: var(--font-mono); }

/* Subtitulo de VARIAS partes ("setor . horario", "leito . prontuario").
   Vira flex so nesse caso: como faixa unica o slot precisa continuar block
   para o text-overflow: ellipsis funcionar \u2014 dentro de um flex container o
   texto vira item anonimo e a reticencia nao acontece.
   Com varias partes, truncar e o comportamento errado de qualquer forma:
   some com o segundo dado inteiro em vez de encurtar o primeiro. */
.hv-listitem__sub--parts {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: 0 var(--space-2);
  white-space: normal; overflow: visible; text-overflow: clip;
}
/* Separador entre partes. currentColor com opacidade em vez de um token de
   cor: o subtitulo muda de cor por contexto (ativo, desabilitado) e o ponto
   precisa acompanhar. */
.hv-listitem__sub--parts > * + *::before {
  content: var(--_sep, "\xB7"); margin-inline-end: var(--space-2);
  opacity: 0.55; font-weight: var(--weight-medium);
}
.hv-listitem__sub--parts[data-sep="none"] > * + *::before { content: none; }
.hv-listitem--wrap .hv-listitem__title,
.hv-listitem--wrap .hv-listitem__sub { white-space: normal; overflow: visible; }

.hv-listitem__actions { flex: none; display: flex; align-items: center; gap: var(--space-1); }
.hv-listitem__meta {
  flex: none; font: var(--text-sm)/1 var(--font-mono); color: var(--text-muted);
}

/* A seta s\xF3 faz sentido quando a linha inteira navega. */
.hv-listitem__chevron { flex: none; color: var(--text-subtle); display: inline-flex; }
.hv-listitem__chevron svg { width: 18px; height: 18px; display: block; }

/* Densidades */
.hv-listitem--sm { padding: var(--space-2) var(--space-3); min-height: var(--tap-min); }
.hv-listitem--lg { padding: var(--space-4) var(--space-4); min-height: 64px; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-listitem-css")) {
  const el = document.createElement("style");
  el.id = "hv-listitem-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Chevron = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "m9 18 6-6-6-6" }));
function ListGroup({ label, plain = false, className = "", children, ...rest }) {
  const grupo = /* @__PURE__ */ React.createElement("div", { className: ["hv-listgroup", plain ? "hv-listgroup--plain" : "", className].filter(Boolean).join(" "), ...rest }, children);
  if (!label) return grupo;
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "hv-listgroup__label" }, label), grupo);
}
function partesDoSubtitulo(subtitle, partes) {
  if (partes) return React.Children.toArray(partes);
  let alvo = subtitle;
  if (React.isValidElement(alvo) && alvo.type === React.Fragment) alvo = alvo.props.children;
  const lista = React.Children.toArray(alvo).filter((n) => !(typeof n === "string" && !n.trim()));
  return lista.length > 1 ? lista : null;
}
function ListItem({
  title,
  subtitle,
  subtitleParts,
  subtitleAs = "text",
  separator = "\xB7",
  media,
  meta,
  actions,
  chevron,
  onClick,
  href,
  disabled = false,
  active = false,
  size = "md",
  wrap = false,
  className = "",
  children,
  ...rest
}) {
  const partes = partesDoSubtitulo(subtitle, subtitleParts);
  const interativo = Boolean(onClick || href);
  const Tag = href ? "a" : onClick ? "button" : "div";
  const mostraSeta = chevron !== void 0 ? chevron : Boolean(href) && !actions;
  const cls = [
    "hv-listitem",
    interativo ? "hv-listitem--interactive" : "",
    size !== "md" ? `hv-listitem--${size}` : "",
    wrap ? "hv-listitem--wrap" : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement(
    Tag,
    {
      className: cls,
      onClick: disabled ? void 0 : onClick,
      href,
      type: Tag === "button" ? "button" : void 0,
      "aria-disabled": disabled || void 0,
      "aria-current": active || void 0,
      ...rest
    },
    media && /* @__PURE__ */ React.createElement("span", { className: "hv-listitem__media" }, media),
    /* @__PURE__ */ React.createElement("span", { className: "hv-listitem__body" }, title && /* @__PURE__ */ React.createElement("span", { className: "hv-listitem__title" }, title), (subtitle || subtitleParts) && /* @__PURE__ */ React.createElement(
      "span",
      {
        className: [
          "hv-listitem__sub",
          subtitleAs === "data" ? "hv-listitem__sub--data" : "",
          partes ? "hv-listitem__sub--parts" : ""
        ].filter(Boolean).join(" "),
        "data-sep": partes && separator === false ? "none" : void 0,
        style: partes && separator && separator !== "\xB7" ? { "--_sep": JSON.stringify(separator) } : void 0
      },
      partes ? partes.map((parte, i) => (
        // Cada parte embrulhada: o separador e `> * + *::before`, e
        // string solta nao e elemento — sem o span o ponto some.
        /* @__PURE__ */ React.createElement("span", { key: i, className: "hv-listitem__part" }, parte)
      )) : subtitle
    ), children),
    meta && /* @__PURE__ */ React.createElement("span", { className: "hv-listitem__meta" }, meta),
    actions && /* @__PURE__ */ React.createElement("span", { className: "hv-listitem__actions" }, actions),
    mostraSeta && /* @__PURE__ */ React.createElement("span", { className: "hv-listitem__chevron", "aria-hidden": "true" }, Chevron)
  );
}
export {
  ListGroup,
  ListItem
};
