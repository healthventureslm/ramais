import React from "react";
const CSS = `
.hv-avatar {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  border-radius: 50%; overflow: hidden; font-family: var(--font-display);
  font-weight: var(--weight-semibold); color: var(--brand-soft-fg); background: var(--petrol-100);
  box-shadow: var(--shadow-ring-inset); position: relative; user-select: none;
}
.hv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.hv-avatar--xs { width: 24px; height: 24px; font-size: 10px; }
.hv-avatar--sm { width: 32px; height: 32px; font-size: 12px; }
.hv-avatar--md { width: 40px; height: 40px; font-size: 15px; }
.hv-avatar--lg { width: 52px; height: 52px; font-size: 19px; }
.hv-avatar__ring { box-shadow: var(--shadow-ring-inset), 0 0 0 2px var(--surface-card), 0 0 0 4px var(--petrol-300); }
/* tone variations so adjacent avatars differ */
.hv-avatar--t1 { background: var(--petrol-100); color: var(--brand-soft-fg); }
.hv-avatar--t2 { background: var(--coral-100);  color: var(--coral-700); }
.hv-avatar--t3 { background: var(--amber-100);  color: var(--amber-700); }
.hv-avatar--t4 { background: var(--emerald-100);color: var(--emerald-700); }
/* fromName derivava um gradiente de hsl(hash % 360, 62%, 52%) com texto
   branco. Duas coisas erradas de uma vez:
     1. Contraste. Branco sobre essa faixa reprova AA em 68% dos matizes, e
        chega a 1,65:1 no amarelo \u2014 iniciais invisiveis. E o matiz vem do
        HASH DO NOME, entao nao e um caso raro: e uma loteria em que alguns
        nomes ganham um avatar ilegivel para sempre.
     2. Paleta. A faixa inteira de matizes inclui os azuis frios que
        colors.css rejeita de proposito.
   fromName agora sorteia entre os MESMOS quatro tons abaixo, que ja tem
   par fundo/texto medido. Continua deterministico \u2014 mesmo nome, mesmo tom. */
`;
if (typeof document !== "undefined" && !document.getElementById("hv-avatar-css")) {
  const el = document.createElement("style");
  el.id = "hv-avatar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function initials(name = "") {
  const p = name.trim().split(/\s+/);
  if (!p[0]) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function hashName(s) {
  let h = 0;
  const str = s.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function toneFor(name) {
  return hashName(name) % 4 + 1;
}
function Avatar({ name = "", fromName, src, size = "md", tone = 1, ring = false, className = "", style, ...rest }) {
  const display = fromName != null ? fromName : name;
  const tomEfetivo = fromName != null && !src ? toneFor(fromName) : tone;
  const cls = [
    "hv-avatar",
    `hv-avatar--${size}`,
    `hv-avatar--t${tomEfetivo}`,
    ring ? "hv-avatar__ring" : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("span", { className: cls, title: display || void 0, style, ...rest }, src ? /* @__PURE__ */ React.createElement("img", { src, alt: display }) : initials(display));
}
export {
  Avatar
};
