import React from "react";
const CSS = `
.hv-breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; font-family: var(--font-sans); min-width: 0; }
.hv-bc__item { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); font-weight: var(--weight-medium);
  color: var(--text-muted); text-decoration: none; padding: var(--space-1) 7px; border-radius: var(--radius-sm); line-height: 1.2;
  max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: var(--transition-colors); }
a.hv-bc__item:hover { color: var(--petrol-700); background: var(--state-brand-hover); }
a.hv-bc__item:active { background: var(--state-brand-press); transition-duration: 0s; }
a.hv-bc__item:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-bc__item--current { color: var(--text-strong); font-weight: var(--weight-semibold); cursor: default; }
.hv-bc__ico { flex: none; display: inline-flex; color: currentColor; }
.hv-bc__ico svg { width: 15px; height: 15px; }
.hv-bc__home { flex: none; }
.hv-bc__home svg { width: 16px; height: 16px; }
.hv-bc__sep { flex: none; display: inline-flex; color: var(--text-subtle); padding: 0 1px; }
.hv-bc__sep svg { width: 15px; height: 15px; display: block; }
.hv-bc__sep--slash { font-size: var(--text-sm); color: var(--border-strong); }

.hv-bc__ellipsis { position: relative; display: inline-flex; }
.hv-bc__ellipsis-btn { display: inline-flex; align-items: center; justify-content: center; border: none; background: transparent;
  cursor: pointer; color: var(--text-muted); padding: var(--space-1) 7px; border-radius: var(--radius-sm); transition: var(--transition-colors); }
.hv-bc__ellipsis-btn:hover { color: var(--petrol-700); background: var(--state-brand-hover); }
.hv-bc__ellipsis-btn:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-bc__ellipsis-btn svg { width: 16px; height: 16px; }
.hv-bc__menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 70; min-width: 180px;
  background: var(--surface-float); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg); padding: 5px; }
.hv-bc__menu-item { display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box; padding: var(--space-2) 10px;
  border: none; background: transparent; cursor: pointer; text-align: left; font-family: var(--font-sans); font-size: var(--text-md);
  color: var(--text-body); border-radius: var(--radius-sm); text-decoration: none; transition: var(--transition-colors); white-space: nowrap; }
.hv-bc__menu-item:hover { background: var(--state-brand-hover); color: var(--text-strong); }
.hv-bc__menu-item:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-bc__menu-item svg { width: 16px; height: 16px; color: var(--text-subtle); }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-breadcrumbs-css")) {
  const el = document.createElement("style");
  el.id = "hv-breadcrumbs-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ChevSep = () => /* @__PURE__ */ React.createElement("span", { className: "hv-bc__sep", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m9 18 6-6-6-6" })));
const SlashSep = () => /* @__PURE__ */ React.createElement("span", { className: "hv-bc__sep hv-bc__sep--slash", "aria-hidden": "true" }, "/");
function Crumb({ item, isLast }) {
  const cls = ["hv-bc__item", isLast ? "hv-bc__item--current" : ""].filter(Boolean).join(" ");
  const inner = /* @__PURE__ */ React.createElement(React.Fragment, null, item.icon && /* @__PURE__ */ React.createElement("span", { className: "hv-bc__ico" }, item.icon), item.label);
  if (isLast || !item.href) {
    return /* @__PURE__ */ React.createElement("span", { className: cls, "aria-current": isLast ? "page" : void 0 }, inner);
  }
  return /* @__PURE__ */ React.createElement("a", { href: item.href, className: cls, onClick: item.onClick }, inner);
}
function Breadcrumbs({ items = [], separator = "chevron", home = false, maxItems = 0, className = "", ...rest }) {
  const [openMenu, setOpenMenu] = React.useState(false);
  const rootRef = React.useRef(null);
  const Sep = separator === "slash" ? SlashSep : ChevSep;
  const gatilhoRef = React.useRef(null);
  React.useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenu(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpenMenu(false);
      if (gatilhoRef.current) gatilhoRef.current.focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);
  let display = items.map((it, i) => ({ it, i }));
  let collapsed = null;
  if (maxItems > 1 && items.length > maxItems) {
    const head = display.slice(0, 1);
    const tail = display.slice(items.length - (maxItems - 1));
    collapsed = display.slice(1, items.length - (maxItems - 1)).map((d) => d.it);
    display = [...head, { ellipsis: true }, ...tail];
  }
  return /* @__PURE__ */ React.createElement("nav", { className: ["hv-breadcrumbs", className].filter(Boolean).join(" "), "aria-label": "Trilha de navega\xE7\xE3o", ref: rootRef, ...rest }, home && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: items[0] && items[0].href ? items[0].href : "#",
      className: "hv-bc__item hv-bc__home",
      "aria-label": "In\xEDcio",
      onClick: items[0] && items[0].onClick
    },
    /* @__PURE__ */ React.createElement("span", { className: "hv-bc__ico", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }), /* @__PURE__ */ React.createElement("path", { d: "M9 22V12h6v10" })))
  ), display.length > 0 && /* @__PURE__ */ React.createElement(Sep, null)), display.map((entry, idx) => {
    const last = idx === display.length - 1;
    if (entry.ellipsis) {
      return /* @__PURE__ */ React.createElement(React.Fragment, { key: "ellipsis" }, /* @__PURE__ */ React.createElement("span", { className: "hv-bc__ellipsis" }, /* @__PURE__ */ React.createElement("button", { ref: gatilhoRef, type: "button", className: "hv-bc__ellipsis-btn", "aria-expanded": openMenu, "aria-label": "Mostrar caminho oculto", onClick: () => setOpenMenu((o) => !o) }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "1" }), /* @__PURE__ */ React.createElement("circle", { cx: "19", cy: "12", r: "1" }), /* @__PURE__ */ React.createElement("circle", { cx: "5", cy: "12", r: "1" }))), openMenu && /* @__PURE__ */ React.createElement("div", { className: "hv-bc__menu", role: "menu" }, collapsed.map((c, ci) => /* @__PURE__ */ React.createElement("a", { key: ci, href: c.href || "#", className: "hv-bc__menu-item", role: "menuitem", onClick: (e) => {
        setOpenMenu(false);
        c.onClick && c.onClick(e);
      } }, c.icon, c.label)))), !last && /* @__PURE__ */ React.createElement(Sep, null));
    }
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: entry.i }, /* @__PURE__ */ React.createElement(Crumb, { item: entry.it, isLast: last }), !last && /* @__PURE__ */ React.createElement(Sep, null));
  }));
}
export {
  Breadcrumbs
};
