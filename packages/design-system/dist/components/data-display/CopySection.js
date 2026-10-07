import React from "react";
import { CopyButton } from "../forms/CopyField.js";
const CSS = `
.hv-copysec {
  background: var(--surface-card); border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
  font-family: var(--font-sans); color: var(--text-body);
  /* Responde \xE0 pr\xF3pria largura: se\xE7\xE3o em coluna lateral ou em drawer quebra
     as linhas de resultado antes de a janela ficar estreita. */
  container-type: inline-size;
}
.hv-copysec__head {
  display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-4) var(--space-3) var(--space-3) var(--space-5);
}
.hv-copysec__heading { flex: 1; min-width: 0; padding-top: var(--space-1); }
.hv-copysec__title {
  font: var(--weight-semibold) var(--text-lg)/1.25 var(--font-display);
  letter-spacing: var(--tracking-snug); color: var(--text-strong); margin: 0;
}
.hv-copysec__sub { font: var(--text-sm)/1.4 var(--font-sans); color: var(--text-muted); margin: var(--space-1) 0 0; }
.hv-copysec__actions { flex: none; display: flex; align-items: center; gap: var(--space-1); }

.hv-copysec__body { padding: 0 var(--space-5) var(--space-5); font: var(--text-md)/1.6 var(--font-sans); }
.hv-copysec__body > :first-child { margin-top: 0; }
.hv-copysec__body > :last-child { margin-bottom: 0; }

/* Linhas de resultado. Grade de tr\xEAs colunas com cabe\xE7alho: sem ele, "5,2" e
   "3,5\u20135,0" s\xE3o dois n\xFAmeros soltos e o leitor adivinha qual \xE9 qual. */
.hv-copysec__rows { margin: var(--space-4) 0 0; }
.hv-copysec__body > .hv-copysec__rows:first-child { margin-top: 0; }
.hv-copysec__row {
  display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.3fr);
  gap: var(--space-4); align-items: baseline;
  padding: var(--space-3) 0; border-top: var(--border-hair) solid var(--border-subtle);
}
.hv-copysec__row--head {
  padding: 0 0 var(--space-2); border-top: 0;
  font: var(--weight-medium) var(--text-xs)/1.2 var(--font-sans); color: var(--text-muted);
}
.hv-copysec__label { font: var(--weight-medium) var(--text-sm)/1.4 var(--font-sans); color: var(--text-strong); overflow-wrap: anywhere; }
.hv-copysec__value { font: var(--weight-semibold) var(--text-sm)/1.4 var(--font-mono); color: var(--text-strong); font-variant-numeric: tabular-nums; }
.hv-copysec__ref { font: var(--text-sm)/1.4 var(--font-sans); color: var(--text-muted); overflow-wrap: anywhere; }
/* Fora da refer\xEAncia: o VALOR muda de tinta e ganha seta + palavra. Cor
   sozinha n\xE3o carrega resultado cl\xEDnico \u2014 daltonismo, impress\xE3o em P&B. */
.hv-copysec__flag {
  display: inline-flex; align-items: center; gap: var(--nudge-2); margin-left: var(--space-2);
  font: var(--weight-semibold) var(--text-xs)/1 var(--font-sans); white-space: nowrap;
}
.hv-copysec__row[data-status="high"] .hv-copysec__value,
.hv-copysec__row[data-status="low"] .hv-copysec__value,
.hv-copysec__row[data-status="high"] .hv-copysec__flag,
.hv-copysec__row[data-status="low"] .hv-copysec__flag { color: var(--warning-fg); }
.hv-copysec__row[data-status="critical"] .hv-copysec__value,
.hv-copysec__row[data-status="critical"] .hv-copysec__flag { color: var(--danger-fg); }

.hv-copysec__note {
  margin: var(--space-4) 0 0; padding-top: var(--space-3);
  border-top: var(--border-hair) solid var(--border-subtle);
  font: var(--text-sm)/1.5 var(--font-sans); color: var(--text-muted);
}
.hv-copysec__comment {
  margin: var(--space-4) 0 0; padding: var(--space-3) var(--space-4);
  background: var(--surface-sunken); border-radius: var(--radius-md);
}
.hv-copysec__comment-by { display: block; font: var(--weight-medium) var(--text-xs)/1.3 var(--font-sans); color: var(--text-muted); margin-bottom: var(--space-1); }
.hv-copysec__comment p { margin: 0; font: var(--text-sm)/1.55 var(--font-sans); color: var(--text-body); }

@container (max-width: 420px) {
  .hv-copysec__row { grid-template-columns: minmax(0, 1fr) auto; row-gap: var(--space-1); }
  .hv-copysec__ref { grid-column: 1 / -1; }
  .hv-copysec__row--head { display: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-copysec-css")) {
  const el = document.createElement("style");
  el.id = "hv-copysec-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const SETA = { high: "\u2191", low: "\u2193", critical: "!" };
function CopySection({
  title,
  subtitle,
  /** Linhas de resultado: { label, value, reference, status }. */
  rows,
  /** Observação ao pé da seção (ressalva, fonte, "dado ilustrativo"). */
  note,
  /** Comentário do profissional sobre a seção. Vai no clipboard, rotulado. */
  comment,
  /** Quem escreveu o comentário — aparece na tela ao lado do rótulo. */
  commentAuthor,
  /** Controles extras no cabeçalho, antes do copiar (ex.: editar comentário). */
  actions,
  /** Substitui o texto montado. String, ou função lida na hora do clique. */
  copyText,
  onCopy,
  labelHeader = "Par\xE2metro",
  valueHeader = "Resultado",
  referenceHeader = "Refer\xEAncia",
  highLabel = "Acima",
  lowLabel = "Abaixo",
  criticalLabel = "Cr\xEDtico",
  noteLabel = "Observa\xE7\xE3o",
  commentLabel = "Coment\xE1rio do profissional",
  copyLabel = "Copiar se\xE7\xE3o",
  copiedLabel = "Copiado",
  className = "",
  children,
  ...rest
}) {
  const corpo = React.useRef(null);
  const textoDoStatus = { high: highLabel, low: lowLabel, critical: criticalLabel };
  const montar = () => {
    if (copyText != null) return typeof copyText === "function" ? copyText() : copyText;
    const partes = [];
    if (title) partes.push(String(title));
    const prosa = corpo.current && corpo.current.querySelector(".hv-copysec__prose");
    if (prosa && prosa.innerText.trim()) partes.push(prosa.innerText.trim());
    if (rows && rows.length) {
      partes.push(rows.map((r) => {
        const st = r.status && textoDoStatus[r.status] ? ` \u2014 ${textoDoStatus[r.status]}` : "";
        const ref = r.reference ? ` (${referenceHeader}: ${r.reference})` : "";
        return `- ${r.label}: ${r.value}${st}${ref}`;
      }).join("\n"));
    }
    if (note) partes.push(`${noteLabel}: ${note}`);
    if (comment) partes.push(`${commentLabel}${commentAuthor ? ` (${commentAuthor})` : ""}: ${comment}`);
    return partes.join("\n\n");
  };
  return /* @__PURE__ */ React.createElement("section", { className: ["hv-copysec", className].filter(Boolean).join(" "), ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__head" }, /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__heading" }, /* @__PURE__ */ React.createElement("h3", { className: "hv-copysec__title" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "hv-copysec__sub" }, subtitle)), /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__actions" }, actions, /* @__PURE__ */ React.createElement(CopyButton, { iconOnly: true, size: "sm", value: montar, label: copyLabel, copiedLabel, onCopy }))), /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__body", ref: corpo }, children && /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__prose" }, children), rows && rows.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__rows", role: "table" }, /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__row hv-copysec__row--head", role: "row" }, /* @__PURE__ */ React.createElement("span", { role: "columnheader" }, labelHeader), /* @__PURE__ */ React.createElement("span", { role: "columnheader" }, valueHeader), /* @__PURE__ */ React.createElement("span", { role: "columnheader" }, referenceHeader)), rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__row", role: "row", key: r.id || i, "data-status": r.status || void 0 }, /* @__PURE__ */ React.createElement("span", { className: "hv-copysec__label", role: "cell" }, r.label), /* @__PURE__ */ React.createElement("span", { role: "cell" }, /* @__PURE__ */ React.createElement("span", { className: "hv-copysec__value" }, r.value), r.status && textoDoStatus[r.status] && /* @__PURE__ */ React.createElement("span", { className: "hv-copysec__flag" }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, SETA[r.status]), textoDoStatus[r.status])), /* @__PURE__ */ React.createElement("span", { className: "hv-copysec__ref", role: "cell" }, r.reference)))), note && /* @__PURE__ */ React.createElement("p", { className: "hv-copysec__note" }, note), comment && /* @__PURE__ */ React.createElement("div", { className: "hv-copysec__comment" }, /* @__PURE__ */ React.createElement("span", { className: "hv-copysec__comment-by" }, commentLabel, commentAuthor && /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 ", commentAuthor)), /* @__PURE__ */ React.createElement("p", null, comment))));
}
export {
  CopySection
};
