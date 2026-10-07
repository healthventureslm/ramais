import React from "react";
import "../_scroll.js";
const CSS = `
.hv-sidebar {
  /* Themeable surface tokens \u2014 overridden by .hv-sidebar--light. Default = brand (petrol). */
  --_w: var(--sidebar-width);
  --_bg: var(--surface-brand);
  --_fg: var(--text-on-brand);
  --_border: var(--veil-line);
  --_section: var(--petrol-300);
  --_divider: var(--veil-line);
  --_item-fg: var(--petrol-200);
  --_item-hover-bg: var(--veil-hover);
  --_item-hover-fg: var(--text-on-brand);
  --_item-press-bg: var(--veil-press);
  --_active-fg: var(--text-on-brand);
  /* Era --coral-500: o item ativo e o contador dele pintados com a tinta do
     LIVE. Sobre petrol-900 o instrumento e luz, nao coral. */
  --_accent: var(--text-on-brand);
  --_pill-bg: var(--veil-brand);
  --_pill-fg: var(--text-on-brand);
  --_count-bg: var(--veil-fill);
  --_count-fg: var(--text-on-brand);
  --_count-active-bg: var(--text-on-brand);
  --_count-active-fg: var(--surface-brand);
  --_footer-border: var(--veil-line);
  --_name: var(--text-on-brand);
  --_sub: var(--petrol-300);
  --_btn-fg: var(--petrol-200);
  --_btn-hover-bg: var(--veil-hover);
  --_btn-hover-fg: var(--text-on-brand);
  --_btn-press-bg: var(--veil-press);
  --_avatar-bg: var(--petrol-800);
  --_avatar-fg: var(--text-on-brand);
  --_tip-bg: var(--surface-inverse);
  --_tip-fg: var(--text-on-inverse);

  width: var(--_w); flex: none; height: 100%; box-sizing: border-box;
  background: var(--_bg); color: var(--_fg);
  display: flex; flex-direction: column; font-family: var(--font-sans);
  border-right: 1px solid var(--_border);
  transition: width var(--dur-slow) var(--ease-soft), transform var(--dur-normal) var(--ease-soft);
}
.hv-sidebar--light {
  --_bg: var(--surface-card);
  --_fg: var(--text-body);
  --_border: var(--border-default);
  --_section: var(--text-muted);
  --_divider: var(--border-subtle);
  --_item-fg: var(--text-body);
  --_item-hover-bg: var(--state-hover);
  --_item-hover-fg: var(--text-strong);
  --_item-press-bg: var(--state-press);
  --_active-fg: var(--petrol-700);
  --_accent: var(--petrol-500);
  --_pill-bg: var(--petrol-50);
  --_pill-fg: var(--petrol-700);
  --_count-bg: var(--surface-sunken);
  --_count-fg: var(--text-body);
  --_count-active-bg: var(--action-primary);
  --_count-active-fg: var(--action-primary-text);
  --_footer-border: var(--border-subtle);
  --_name: var(--text-strong);
  --_sub: var(--text-muted);
  --_btn-fg: var(--text-muted);
  --_btn-hover-bg: var(--surface-sunken);
  --_btn-hover-fg: var(--text-strong);
  --_btn-press-bg: var(--state-press-deep);
  --_avatar-bg: var(--petrol-100);
  --_avatar-fg: var(--petrol-700);
}
.hv-sidebar--collapsed { --_w: var(--sidebar-width-collapsed); }

/* ---- Brand / header ---- */
.hv-sidebar__brand { display: flex; align-items: center; gap: 11px; padding: 18px var(--space-4) var(--space-4); min-height: var(--header-height); box-sizing: border-box; }
.hv-sidebar__mark { width: 34px; height: 34px; flex: none; border-radius: 9px; object-fit: cover; display: block; }
.hv-sidebar__mark--default { background: var(--petrol-700); }
.hv-sidebar__markbtn { position: relative; width: 34px; height: 34px; flex: none; border: none; background: transparent; padding: 0; cursor: pointer; border-radius: 9px; }
.hv-sidebar__mark-face { display: block; transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-sidebar__mark-expand { position: absolute; inset: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; color: var(--_fg); background: var(--_item-hover-bg); opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-sidebar__mark-expand svg { width: 18px; height: 18px; display: block; }
.hv-sidebar__markbtn:hover .hv-sidebar__mark-face, .hv-sidebar__markbtn:focus-visible .hv-sidebar__mark-face { opacity: 0; }
.hv-sidebar__markbtn:hover .hv-sidebar__mark-expand, .hv-sidebar__markbtn:focus-visible .hv-sidebar__mark-expand { opacity: 1; }
.hv-sidebar__brandtext { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-sidebar--collapsed .hv-sidebar__brandtext { opacity: 0; pointer-events: none; }
.hv-sidebar__wm { display: flex; flex-direction: column; line-height: 1; white-space: nowrap; }
.hv-sidebar__wm b { font: var(--weight-bold) 16px/1 var(--font-display); letter-spacing: var(--tracking-tight); color: var(--_name); }
.hv-sidebar__wm span { font: var(--weight-medium) 9.5px/1 var(--font-mono); color: var(--_sub); margin-top: 5px; letter-spacing: var(--tracking-wide); }
.hv-sidebar__collapse-btn { flex: none; margin-left: auto; border: none; background: transparent; color: var(--_btn-fg); cursor: pointer; padding: 6px; border-radius: var(--radius-sm); display: inline-flex; transition: var(--transition-colors); }
.hv-sidebar__collapse-btn:hover { background: var(--_btn-hover-bg); color: var(--_btn-hover-fg); }
.hv-sidebar__collapse-btn:active { background: var(--_btn-press-bg); transition-duration: 0s; }
.hv-sidebar__collapse-btn svg { width: 18px; height: 18px; display: block; }

/* ---- Nav list ---- */
.hv-sidebar__nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: var(--space-2) 10px; display: flex; flex-direction: column; gap: 1px; }
/* Collapsed: let styled tooltips escape to the right (rail is short, scroll not needed) */
.hv-sidebar--collapsed .hv-sidebar__nav { overflow: visible; }
.hv-sidebar__section { font: var(--weight-semibold) 10px/1 var(--font-sans); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--_section); padding: var(--space-4) var(--space-3) 7px; }
/* Collapsed: section labels keep their full box height (text hidden, centered divider line)
   so nav items don't shift vertically when toggling. */
.hv-sidebar--collapsed .hv-sidebar__nav > .hv-sidebar__section { color: transparent; position: relative; }
.hv-sidebar--collapsed .hv-sidebar__nav > .hv-sidebar__section::after,
.hv-sidebar--collapsed .hv-sidebar__grouphead::after {
  content: ""; position: absolute; left: 14px; right: 14px; top: 50%; transform: translateY(-50%);
  height: 1px; background: var(--_divider);
}

.hv-sidebar__grouphead { display: flex; align-items: center; justify-content: space-between; width: 100%; border: none; background: transparent; cursor: pointer; padding: var(--space-4) var(--space-3) 7px; font-family: var(--font-sans); border-radius: var(--radius-sm); }
.hv-sidebar__grouphead .hv-sidebar__section { padding: 0; }
.hv-sidebar__chevron { color: var(--_section); display: inline-flex; transition: transform var(--dur-fast) var(--ease-standard); }
.hv-sidebar__chevron svg { width: 14px; height: 14px; display: block; }
.hv-sidebar__group[data-open="false"] .hv-sidebar__chevron { transform: rotate(-90deg); }
/* Grade 0fr -> 1fr, nao max-height.
   O max-height: 600px era o hack classico de acordeao e tinha os dois
   defeitos dele: grupo com mais de 600px de itens era CORTADO na abertura, e
   grupo com menos gastava a animacao inteira percorrendo altura que nao
   existe \u2014 a pessoa ve o conteudo parar e a transicao continuar rodando.
   0fr -> 1fr anima a altura REAL do conteudo, seja ela qual for. */
.hv-sidebar__groupitems { display: grid; grid-template-rows: 1fr; overflow: hidden;
  /* A COLUNA precisa ser declarada. Sem isto a trilha implicita e auto, ou
     seja, do tamanho do CONTEUDO \u2014 e no rail colapsado o item guarda a
     largura do rotulo escondido (197px). O preenchimento do item ativo
     vazava 135px para fora dos 72px do rail, por cima da pagina. O flex de
     antes nao tinha esse risco porque esticava os filhos no container. */
  grid-template-columns: minmax(0, 1fr);
  transition: grid-template-rows var(--dur-normal) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard); }
.hv-sidebar__groupitems > * { min-height: 0; }
.hv-sidebar__groupinner { display: flex; flex-direction: column; gap: 1px; }
.hv-sidebar__group[data-open="false"] .hv-sidebar__groupitems { grid-template-rows: 0fr; opacity: 0; }
.hv-sidebar--collapsed .hv-sidebar__groupitems { grid-template-rows: 1fr; opacity: 1; overflow: visible; }

.hv-navitem {
  display: flex; align-items: center; gap: 11px; width: 100%; box-sizing: border-box;
  padding: 9px 14px; border: none; background: transparent; cursor: pointer;
  color: var(--_item-fg); font-family: var(--font-sans); font-size: var(--text-md); font-weight: var(--weight-medium);
  border-radius: var(--radius-md); text-align: left; text-decoration: none;
  transition: var(--transition-colors); position: relative; white-space: nowrap;
}
.hv-navitem:hover:not(.hv-navitem--active) { background: var(--_item-hover-bg); color: var(--_item-hover-fg); }
.hv-navitem:active:not(.hv-navitem--active) { background: var(--_item-press-bg); transition-duration: 0s; }
/* activeStyle="accent" (padrao) marcava o ativo com FUNDO + barra na borda \u2014
   dois mecanismos no mesmo item. O prop existe para escolher entre dois
   jeitos, e agora cada um e um jeito so: accent e a barra fina + peso;
   pill (logo abaixo) e o preenchimento + peso. */
.hv-navitem--active { color: var(--_active-fg); font-weight: var(--weight-semibold); }
.hv-navitem--active::before { content: ""; position: absolute; left: -10px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--_accent); }
.hv-sidebar--pill .hv-navitem--active { background: var(--_pill-bg); color: var(--_pill-fg); font-weight: var(--weight-semibold); }
.hv-sidebar--pill .hv-navitem--active::before { display: none; }
.hv-navitem__icon { flex: none; display: inline-flex; }
.hv-navitem__icon svg { width: 19px; height: 19px; }
.hv-navitem__label { flex: 1; overflow: hidden; text-overflow: ellipsis; transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-navitem__count { font-family: var(--font-mono); font-size: 11px; background: var(--_count-bg); color: var(--_count-fg); padding: 1px 7px; border-radius: var(--radius-pill); transition: opacity var(--dur-fast) var(--ease-standard); }
.hv-navitem--active .hv-navitem__count { background: var(--_count-active-bg); color: var(--_count-active-fg); }
.hv-navitem__badge { flex: none; width: 7px; height: 7px; border-radius: var(--radius-pill); background: var(--_accent); box-shadow: 0 0 0 2px var(--_bg); }

.hv-sidebar--collapsed .hv-navitem__label, .hv-sidebar--collapsed .hv-navitem__count { opacity: 0; }
.hv-sidebar--collapsed .hv-navitem__badge { position: absolute; top: 7px; left: 28px; }
.hv-sidebar--collapsed .hv-navitem--active::before { left: 0; }
/* Group heads stay at full height (rendered as a centered divider) so items keep their Y \u2014 no jump. */
.hv-sidebar--collapsed .hv-sidebar__grouphead { pointer-events: none; position: relative; }
.hv-sidebar--collapsed .hv-sidebar__grouphead .hv-sidebar__section { color: transparent; }
.hv-sidebar--collapsed .hv-sidebar__chevron { visibility: hidden; }

/* ---- Footer ---- */
.hv-sidebar__footer { border-top: 1px solid var(--_footer-border); padding: var(--space-3); display: flex; align-items: center; gap: 10px; }
.hv-sidebar__user { display: flex; flex-direction: column; line-height: 1.2; overflow: hidden; flex: 1; min-width: 0; }
.hv-sidebar__user b { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--_name); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hv-sidebar__user span { font-size: var(--text-xs); color: var(--_sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hv-sidebar__user--btn { border: none; background: transparent; cursor: pointer; text-align: left; font-family: var(--font-sans); padding: 0; }
.hv-sidebar__user--btn:hover b { text-decoration: underline; }
.hv-sidebar__user--btn:active { background: var(--_item-press-bg); transition-duration: 0s; }
.hv-sidebar__useractions { flex: none; display: flex; align-items: center; gap: 2px; }
.hv-sidebar__footer-btn { position: relative; flex: none; border: none; background: transparent; color: var(--_btn-fg); cursor: pointer; padding: 6px; border-radius: var(--radius-sm); transition: var(--transition-colors); display: inline-flex; }
.hv-sidebar__footer-btn:hover { background: var(--_btn-hover-bg); color: var(--_btn-hover-fg); }
.hv-sidebar__footer-btn:active { background: var(--_btn-press-bg); transition-duration: 0s; }
.hv-sidebar__footer-btn svg { width: 17px; height: 17px; display: block; }
.hv-sidebar__actbadge { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; box-sizing: border-box; padding: 0 3px; border-radius: var(--radius-pill); background: var(--coral-500); color: var(--text-on-accent); font: var(--weight-bold) 9px/14px var(--font-mono); text-align: center; box-shadow: 0 0 0 2px var(--_bg); }
.hv-sidebar__actbadge:empty { min-width: 7px; width: 7px; height: 7px; padding: 0; }
.hv-sidebar__avatar { flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--_avatar-bg); color: var(--_avatar-fg); display: inline-flex; align-items: center; justify-content: center; object-fit: cover; font: var(--weight-semibold) 13px var(--font-display); }
.hv-sidebar__avatarbtn { flex: none; border: none; background: transparent; padding: 0; cursor: pointer; border-radius: 50%; position: relative; display: inline-flex; }

/* Collapsed footer: stack vertically & centered, keep actions visible (icons + tooltips) */
.hv-sidebar--collapsed .hv-sidebar__footer { flex-direction: column; align-items: center; gap: 6px; padding: 10px var(--space-2); }
.hv-sidebar--collapsed .hv-sidebar__user, .hv-sidebar--collapsed .hv-sidebar__user--btn { display: none; }
.hv-sidebar--collapsed .hv-sidebar__useractions { flex-direction: column; gap: var(--space-1); }

/* ---- Focus ring ---- */
.hv-navitem:focus-visible, .hv-sidebar__grouphead:focus-visible, .hv-sidebar__footer-btn:focus-visible,
.hv-sidebar__collapse-btn:focus-visible, .hv-sidebar__markbtn:focus-visible, .hv-sidebar__avatarbtn:focus-visible,
.hv-sidebar__user--btn:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

/* ---- Collapsed tooltips (label to the right) ---- */
.hv-sidebar--collapsed [data-tip] { position: relative; }
.hv-sidebar--collapsed [data-tip]::after {
  content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%;
  transform: translateY(-50%) translateX(-4px);
  background: var(--_tip-bg); color: var(--_tip-fg);
  font: var(--weight-medium) var(--text-xs)/1 var(--font-sans); white-space: nowrap;
  padding: 6px 9px; border-radius: var(--radius-sm); box-shadow: var(--shadow-md);
  opacity: 0; pointer-events: none; z-index: 90;
  transition: opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
}
.hv-sidebar--collapsed [data-tip]:hover::after, .hv-sidebar--collapsed [data-tip]:focus-visible::after { opacity: 1; transform: translateY(-50%) translateX(0); }

/* ---- Mobile off-canvas drawer ---- */
.hv-sidebar__backdrop { position: fixed; inset: 0; z-index: 79; background: var(--surface-overlay); opacity: 0; pointer-events: none; transition: opacity var(--dur-normal) var(--ease-standard); }
.hv-sidebar__backdrop--open { opacity: 1; pointer-events: auto; }
.hv-sidebar--mobile { position: fixed; top: 0; left: 0; z-index: 80; transform: translateX(-100%); box-shadow: var(--shadow-xl); }
.hv-sidebar--mobile.hv-sidebar--open { transform: translateX(0); }

@media (prefers-reduced-motion: reduce) {
  .hv-sidebar, .hv-sidebar__brandtext, .hv-navitem__label, .hv-navitem__count, .hv-sidebar__groupitems,
  .hv-sidebar__mark-face, .hv-sidebar__mark-expand, .hv-sidebar--collapsed [data-tip]::after { transition: none !important; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-sidebar-css")) {
  const el = document.createElement("style");
  el.id = "hv-sidebar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ChevronIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" }));
const PanelCollapseIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M9 4v16" }), /* @__PURE__ */ React.createElement("path", { d: "m15 10-2 2 2 2" }));
const PanelExpandIcon = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M9 4v16" }), /* @__PURE__ */ React.createElement("path", { d: "m13 10 2 2-2 2" }));
function lsGet(key) {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch (e) {
    return null;
  }
}
function lsSet(key, val) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, val);
  } catch (e) {
  }
}
function loadGroupState(items, persistKey) {
  const state = {};
  (items || []).forEach((it) => {
    if (it.type === "group" && it.id != null) {
      let open = it.defaultOpen !== false;
      if (persistKey) {
        const v = lsGet(`${persistKey}:${it.id}`);
        if (v != null) open = v === "1";
      }
      state[it.id] = open;
    }
  });
  return state;
}
function SidebarNav({
  brand = { title: "Health Ventures", subtitle: "by Health Ventures", markSrc: null },
  brandSlot,
  items = [],
  activeId,
  onSelect,
  user,
  userActions,
  onUserClick,
  collapsed,
  collapsible = false,
  onCollapsedChange,
  surface = "brand",
  activeStyle = "accent",
  footerAction,
  mobile = false,
  mobileOpen = false,
  onMobileClose,
  persistKey,
  className = ""
}) {
  const [openGroups, setOpenGroups] = React.useState(() => loadGroupState(items, persistKey));
  const controlledCollapsed = collapsed !== void 0;
  const [internalCollapsed, setInternalCollapsed] = React.useState(() => {
    if (collapsible && !controlledCollapsed && persistKey) {
      const v = lsGet(`${persistKey}:collapsed`);
      if (v != null) return v === "1";
    }
    return false;
  });
  const isCollapsed = controlledCollapsed ? collapsed : collapsible ? internalCollapsed : false;
  const setCollapsed = (next) => {
    if (!controlledCollapsed) {
      setInternalCollapsed(next);
      if (persistKey) lsSet(`${persistKey}:collapsed`, next ? "1" : "0");
    }
    onCollapsedChange && onCollapsedChange(next);
  };
  const toggleGroup = (id) => {
    setOpenGroups((prev) => {
      const open = !(prev[id] ?? true);
      if (persistKey) lsSet(`${persistKey}:${id}`, open ? "1" : "0");
      return { ...prev, [id]: open };
    });
  };
  const renderItem = (it, tabbable = true) => {
    const labelStr = typeof it.label === "string" ? it.label : void 0;
    const Tag = it.href ? "a" : "button";
    return /* @__PURE__ */ React.createElement(
      Tag,
      {
        key: it.id,
        href: it.href || void 0,
        type: it.href ? void 0 : "button",
        className: ["hv-navitem", it.id === activeId ? "hv-navitem--active" : ""].filter(Boolean).join(" "),
        onClick: () => {
          onSelect && onSelect(it.id);
          if (mobile && onMobileClose) onMobileClose();
        },
        "aria-label": labelStr,
        "data-tip": labelStr,
        tabIndex: tabbable ? void 0 : -1,
        "aria-current": it.id === activeId ? "page" : void 0
      },
      /* @__PURE__ */ React.createElement("span", { className: "hv-navitem__icon" }, it.icon),
      /* @__PURE__ */ React.createElement("span", { className: "hv-navitem__label" }, it.label),
      it.badge ? /* @__PURE__ */ React.createElement("span", { className: "hv-navitem__badge" }) : null,
      it.count != null && /* @__PURE__ */ React.createElement("span", { className: "hv-navitem__count" }, it.count)
    );
  };
  const cls = [
    "hv-sidebar",
    surface === "light" ? "hv-sidebar--light" : "",
    activeStyle === "pill" ? "hv-sidebar--pill" : "",
    isCollapsed ? "hv-sidebar--collapsed" : "",
    mobile ? "hv-sidebar--mobile" : "",
    mobile && mobileOpen ? "hv-sidebar--open" : "",
    className
  ].filter(Boolean).join(" ");
  const lockup = brandSlot || brand && brand.render;
  const markInner = brand.markSrc ? /* @__PURE__ */ React.createElement("img", { className: "hv-sidebar__mark", src: brand.markSrc, alt: "" }) : /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__mark hv-sidebar__mark--default" });
  const markEl = collapsible && isCollapsed ? /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-sidebar__markbtn",
      onClick: () => setCollapsed(false),
      "aria-label": "Expandir menu",
      title: "Expandir menu",
      "data-tip": "Expandir menu"
    },
    /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__mark-face" }, markInner),
    /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__mark-expand", "aria-hidden": "true" }, PanelExpandIcon)
  ) : markInner;
  const avatarVisual = user && (user.avatarSrc ? /* @__PURE__ */ React.createElement("img", { className: "hv-sidebar__avatar", src: user.avatarSrc, alt: "" }) : /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__avatar" }, user.initials));
  const avatarEl = user && (onUserClick ? /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-sidebar__avatarbtn",
      onClick: onUserClick,
      "aria-label": user.name,
      title: user.name,
      "data-tip": user.name
    },
    avatarVisual
  ) : avatarVisual);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, mobile && /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-sidebar__backdrop", mobileOpen ? "hv-sidebar__backdrop--open" : ""].filter(Boolean).join(" "),
      onClick: onMobileClose,
      "aria-hidden": "true"
    }
  ), /* @__PURE__ */ React.createElement("nav", { className: cls, "aria-label": "Navega\xE7\xE3o principal" }, /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__brand" }, markEl, /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__brandtext" }, lockup ? lockup : /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__wm" }, /* @__PURE__ */ React.createElement("b", null, brand.title), brand.subtitle && /* @__PURE__ */ React.createElement("span", null, brand.subtitle))), collapsible && !isCollapsed && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-sidebar__collapse-btn",
      onClick: () => setCollapsed(true),
      "aria-label": "Recolher menu",
      title: "Recolher menu"
    },
    PanelCollapseIcon
  )), /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__nav hv-scroll hv-scroll--brand" }, items.map((it, i) => {
    if (it.type === "section") {
      return /* @__PURE__ */ React.createElement("div", { key: `s${i}`, className: "hv-sidebar__section" }, it.label);
    }
    if (it.type === "group") {
      const open = isCollapsed ? true : openGroups[it.id] ?? it.defaultOpen !== false;
      return /* @__PURE__ */ React.createElement("div", { key: it.id != null ? it.id : `g${i}`, className: "hv-sidebar__group", "data-open": open }, /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: "hv-sidebar__grouphead",
          onClick: () => toggleGroup(it.id),
          "aria-expanded": open
        },
        /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__section" }, it.label),
        /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__chevron" }, ChevronIcon)
      ), /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__groupitems", "aria-hidden": !open && !isCollapsed ? true : void 0 }, /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__groupinner" }, (it.items || []).map((sub) => renderItem(sub, open || isCollapsed)))));
    }
    return renderItem(it);
  })), user && /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__footer" }, avatarEl, onUserClick ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-sidebar__user hv-sidebar__user--btn", onClick: onUserClick }, /* @__PURE__ */ React.createElement("b", null, user.name), user.role && /* @__PURE__ */ React.createElement("span", null, user.role)) : /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__user" }, /* @__PURE__ */ React.createElement("b", null, user.name), user.role && /* @__PURE__ */ React.createElement("span", null, user.role)), userActions && userActions.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-sidebar__useractions" }, userActions.map((a, ai) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: a.id != null ? a.id : ai,
      type: "button",
      className: "hv-sidebar__footer-btn",
      onClick: a.onClick,
      "aria-label": a.label,
      title: a.label,
      "data-tip": a.label
    },
    a.icon,
    a.badge != null && /* @__PURE__ */ React.createElement("span", { className: "hv-sidebar__actbadge" }, a.badge === true ? "" : a.badge)
  ))), footerAction)));
}
export {
  SidebarNav
};
