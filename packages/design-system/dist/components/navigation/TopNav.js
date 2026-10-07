import React from "react";
import { Avatar } from "../data-display/Avatar.js";
import { Menu } from "../overlays/Menu.js";
const CSS = `
.hv-topnav {
  position: relative; z-index: 40;
  font-family: var(--font-sans);
  /* Responde \xE0 PR\xD3PRIA largura, n\xE3o \xE0 da janela: a barra pode estar dentro de
     um painel, de um preview, de uma coluna. */
  container: hv-topnav / inline-size;
  /* Os mesmos pap\xE9is da SidebarNav, com os mesmos valores por superf\xEDcie. */
  --_bg: var(--surface-brand);
  --_fg: var(--text-on-brand);
  --_item-fg: var(--petrol-200);
  --_item-hover-bg: var(--veil-hover);
  --_item-press-bg: var(--veil-press);
  --_active-bg: var(--veil-fill);
  --_active-fg: var(--text-on-brand);
  --_sub: var(--petrol-200);
  --_focus: var(--shadow-focus-on-brand);
  --_line: var(--veil-line);
}
.hv-topnav--light {
  --_bg: var(--surface-card);
  --_fg: var(--text-strong);
  --_item-fg: var(--text-body);
  --_item-hover-bg: var(--state-hover);
  --_item-press-bg: var(--state-press);
  --_active-bg: var(--surface-brand-soft);
  --_active-fg: var(--brand-soft-fg);
  --_sub: var(--text-muted);
  --_focus: var(--shadow-focus);
  --_line: var(--border-subtle);
}
.hv-topnav--sticky { position: sticky; top: 0; }

/* bar: faixa de ponta a ponta, colada no topo. floating: objeto pousado sobre
   a p\xE1gina, com folga em volta \u2014 a barra vira uma pe\xE7a, n\xE3o uma borda. */
.hv-topnav__in {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  gap: var(--space-4);
  min-height: 60px; padding: 0 var(--space-5);
  background: var(--_bg); color: var(--_fg);
}
.hv-topnav--bar.hv-topnav--light .hv-topnav__in { box-shadow: inset 0 -1px 0 var(--_line); }
.hv-topnav--floating { padding: var(--space-3) var(--space-4) 0; }
.hv-topnav--floating .hv-topnav__in {
  min-height: 56px; padding: 0 var(--space-2) 0 var(--space-4);
  border-radius: var(--radius-lg);
}
.hv-topnav--floating.hv-topnav--light .hv-topnav__in { box-shadow: var(--shadow-sm); }

.hv-topnav__brand {
  justify-self: start; min-width: 0;
  display: inline-flex; align-items: center; gap: var(--space-2);
  color: var(--_fg); text-decoration: none;
  font: var(--weight-bold) var(--text-lg)/1 var(--font-display); letter-spacing: -0.02em; white-space: nowrap;
  border-radius: var(--radius-sm);
}
a.hv-topnav__brand:focus-visible { outline: none; box-shadow: var(--_focus); }
.hv-topnav__mark { width: 28px; height: 28px; border-radius: 7px; flex: none; display: block; }
/* Monograma petrol sobre faixa petrol some; um fio de v\xE9u d\xE1 o contorno. */
.hv-topnav--brand .hv-topnav__mark { box-shadow: 0 0 0 1px var(--veil-line); }

.hv-topnav__nav { display: flex; align-items: center; gap: var(--space-1); }
.hv-topnav__item {
  position: relative;
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-height: 40px; padding: 0 var(--space-3);
  border: 0; border-radius: var(--radius-md); background: transparent;
  color: var(--_item-fg); text-decoration: none; cursor: pointer; white-space: nowrap;
  font: var(--weight-medium) var(--text-md)/1 var(--font-sans);
  transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.hv-topnav__item svg { width: 18px; height: 18px; flex: none; }
.hv-topnav__item:hover:not([aria-current="page"]) { background: var(--_item-hover-bg); color: var(--_fg); }
.hv-topnav__item:active:not([aria-current="page"]) { background: var(--_item-press-bg); transition-duration: 0s; }
.hv-topnav__item:focus-visible { outline: none; box-shadow: var(--_focus); }
/* Ativo \xE9 CAMADA, n\xE3o cor nova: sobre marca o v\xE9u, sobre claro o tingido da
   marca. \xC9 o mesmo par da SidebarNav activeStyle="pill". */
.hv-topnav__item[aria-current="page"] { background: var(--_active-bg); color: var(--_active-fg); font-weight: var(--weight-semibold); }
.hv-topnav__dot {
  position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; border-radius: 50%;
  background: var(--action-primary); box-shadow: 0 0 0 2px var(--_bg);
}
.hv-topnav--brand .hv-topnav__dot { background: var(--text-on-brand); }

.hv-topnav__end { justify-self: end; display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.hv-topnav__user {
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-height: 44px; padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
  border: 0; border-radius: var(--radius-md); background: transparent; cursor: pointer; text-align: left;
  color: var(--_fg); font-family: var(--font-sans);
  transition: background var(--dur-fast) var(--ease-standard);
}
.hv-topnav__user:hover { background: var(--_item-hover-bg); }
.hv-topnav__user:active { background: var(--_item-press-bg); transition-duration: 0s; }
.hv-topnav__user:focus-visible { outline: none; box-shadow: var(--_focus); }
.hv-topnav__who { display: flex; flex-direction: column; gap: var(--nudge-1); min-width: 0; max-width: 180px; }
.hv-topnav__who b { font: var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-topnav__who span { font: var(--text-xs)/1.2 var(--font-sans); color: var(--_sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Estreitando, sai primeiro o nome do usu\xE1rio (o avatar basta), depois os
   r\xF3tulos dos itens \u2014 poucos destinos ainda se reconhecem pelo glifo, e a
   alternativa (gaveta) cobraria um toque a mais em TODA navega\xE7\xE3o. O nome do
   item continua no texto acess\xEDvel e no title. Por \xFAltimo, o nome da marca. */
@container hv-topnav (max-width: 760px) {
  .hv-topnav__who { display: none; }
}
@container hv-topnav (max-width: 680px) {
  .hv-topnav__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .hv-topnav__item { min-width: 44px; justify-content: center; padding: 0; }
}
/* A marca vai embora ANTES de encostar nos itens: com o nome inteiro ela
   invadia a primeira coluna por baixo do "In\xEDcio". */
@container hv-topnav (max-width: 600px) {
  .hv-topnav__brand-text { display: none; }
  .hv-topnav__in { gap: var(--space-2); padding: 0 var(--space-3); }
}
@media (prefers-reduced-motion: reduce) {
  .hv-topnav__item, .hv-topnav__user { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-topnav-css")) {
  const el = document.createElement("style");
  el.id = "hv-topnav-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function TopNav({
  brand = { title: "Health Ventures", markSrc: null },
  /** Nó que substitui o lockup inteiro (marca + nome). */
  brandSlot,
  /** Destino da marca. Sem ele, a marca é só rótulo. */
  brandHref,
  items = [],
  activeId,
  onSelect,
  user,
  /** Itens do menu que abre no bloco do usuário (Menu do DS). */
  userMenu,
  /** Sem `userMenu`, o bloco do usuário vira botão direto (perfil). */
  onUserClick,
  surface = "brand",
  variant = "bar",
  sticky = true,
  ariaLabel = "Navega\xE7\xE3o principal",
  userMenuLabel = "Sua conta",
  className = "",
  ...rest
}) {
  const Marca = brandHref ? "a" : "span";
  const lockup = brandSlot || /* @__PURE__ */ React.createElement(React.Fragment, null, brand.markSrc && /* @__PURE__ */ React.createElement("img", { className: "hv-topnav__mark", src: brand.markSrc, alt: "" }), /* @__PURE__ */ React.createElement("span", { className: "hv-topnav__brand-text" }, brand.title));
  const gatilho = user && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-topnav__user",
      "aria-label": userMenuLabel,
      onClick: userMenu && userMenu.length ? void 0 : onUserClick
    },
    /* @__PURE__ */ React.createElement(Avatar, { name: user.name, src: user.avatarSrc, size: "sm" }),
    /* @__PURE__ */ React.createElement("span", { className: "hv-topnav__who" }, /* @__PURE__ */ React.createElement("b", null, user.name), user.role && /* @__PURE__ */ React.createElement("span", null, user.role))
  );
  const cls = [
    "hv-topnav",
    `hv-topnav--${surface === "light" ? "light" : "brand"}`,
    `hv-topnav--${variant === "floating" ? "floating" : "bar"}`,
    sticky ? "hv-topnav--sticky" : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("header", { className: cls, ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-topnav__in" }, /* @__PURE__ */ React.createElement(Marca, { className: "hv-topnav__brand", href: brandHref, "aria-label": brandHref ? brand.title : void 0 }, lockup), /* @__PURE__ */ React.createElement("nav", { className: "hv-topnav__nav", "aria-label": ariaLabel }, items.map((it) => {
    const ativo = it.id === activeId;
    const Tag = it.href ? "a" : "button";
    return /* @__PURE__ */ React.createElement(
      Tag,
      {
        key: it.id,
        className: "hv-topnav__item",
        type: it.href ? void 0 : "button",
        href: it.href,
        "aria-current": ativo ? "page" : void 0,
        title: typeof it.label === "string" ? it.label : void 0,
        onClick: (e) => {
          if (it.href && onSelect) e.preventDefault();
          onSelect && onSelect(it.id);
        }
      },
      it.icon,
      /* @__PURE__ */ React.createElement("span", { className: "hv-topnav__label" }, it.label),
      it.badge && /* @__PURE__ */ React.createElement("span", { className: "hv-topnav__dot", "aria-hidden": "true" })
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "hv-topnav__end" }, gatilho && (userMenu && userMenu.length ? /* @__PURE__ */ React.createElement(Menu, { align: "end", trigger: gatilho, items: userMenu }) : gatilho))));
}
export {
  TopNav
};
