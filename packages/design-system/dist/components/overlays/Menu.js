import React from "react";
import { ActionSheet } from "./ActionSheet.js";
import { useViewport } from "../hooks/viewport.js";
import ReactDOM from "react-dom";
const createPortal = ReactDOM.createPortal;
const CSS = `
.hv-menu { position: relative; display: inline-flex; }
.hv-menu__pop {
  position: absolute; z-index: 80; min-width: 200px;
  background: var(--surface-float); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 5px;
  opacity: 1; transform: translateY(0) scale(1); transform-origin: top right;
  transition: transform var(--dur-fast) var(--ease-entrance);
}
.hv-menu__pop[data-enter="false"] { transform: translateY(-6px) scale(0.985); }
/* A entrada do popover e geometria: quem pediu menos movimento recebe o
   menu ja no lugar, sem deslize nem escala. */
@media (prefers-reduced-motion: reduce) {
  .hv-menu__pop { transition: none; }
  .hv-menu__pop[data-enter="false"] { transform: none; }
}
.hv-menu__pop--fixed { z-index: 200; }
.hv-menu__pop--start { transform-origin: top left; left: 0; }
.hv-menu__pop--end { right: 0; }
.hv-menu__pop--up { transform-origin: bottom right; }
.hv-menu__pop--end:not(.hv-menu__pop--fixed) { right: 0; }
.hv-menu__pop--up:not(.hv-menu__pop--fixed) { top: auto; bottom: calc(100% + 6px); }
.hv-menu__pop--end:not(.hv-menu__pop--fixed):not(.hv-menu__pop--up),
.hv-menu__pop--start:not(.hv-menu__pop--fixed):not(.hv-menu__pop--up) { top: calc(100% + 6px); }

.hv-menu__item {
  display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box;
  padding: 9px 10px; border: none; background: transparent; cursor: pointer; text-align: left;
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-body);
  border-radius: var(--radius-sm); transition: var(--transition-colors); line-height: 1.3;
}
.hv-menu__item:hover, .hv-menu__item[data-active="true"] { background: var(--state-brand-hover); color: var(--text-strong); }
.hv-menu__item:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-menu__item:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.hv-menu__item--danger { color: var(--crimson-600); }
.hv-menu__item--danger:hover, .hv-menu__item--danger[data-active="true"] { background: var(--danger-bg); color: var(--crimson-700); }
.hv-menu__item--danger:active { background: var(--danger-hover); }
.hv-menu__ico { flex: none; display: inline-flex; color: var(--text-subtle); }
.hv-menu__item:hover .hv-menu__ico, .hv-menu__item[data-active="true"] .hv-menu__ico { color: var(--petrol-600); }
.hv-menu__item--danger .hv-menu__ico { color: var(--crimson-500); }
.hv-menu__ico svg { width: 17px; height: 17px; display: block; }
.hv-menu__label { flex: 1; }
.hv-menu__shortcut { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-subtle); }
.hv-menu__sep { height: 1px; background: var(--border-subtle); margin: 5px var(--space-1); }
.hv-menu__heading { font: var(--weight-semibold) var(--text-2xs)/1 var(--font-sans); letter-spacing: var(--tracking-wider);
  text-transform: uppercase; color: var(--text-subtle); padding: 9px 10px 5px; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-menu-css")) {
  const el = document.createElement("style");
  el.id = "hv-menu-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Menu({
  trigger,
  items = [],
  align = "end",
  side = "down",
  className = "",
  onAction,
  responsive = true,
  sheetTitle,
  container
}) {
  const { isMobile } = useViewport();
  const [open, setOpen] = React.useState(false);
  const [enter, setEnter] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [pos, setPos] = React.useState(null);
  const rootRef = React.useRef(null);
  const popRef = React.useRef(null);
  const actionable = items.map((it, i) => it.type === "separator" || it.type === "heading" ? null : i).filter((x) => x !== null);
  const place = React.useCallback(() => {
    const trg = rootRef.current && rootRef.current.querySelector(".hv-menu__trigger");
    if (!trg) return;
    const r = trg.getBoundingClientRect();
    const W = 220, gap = 6;
    let left = align === "end" ? r.right - W : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8));
    const down = side !== "up";
    const top = down ? r.bottom + gap : null;
    const bottom = down ? null : window.innerHeight - r.top + gap;
    setPos({ left, top, bottom, minWidth: Math.max(W, r.width) });
  }, [align, side]);
  React.useEffect(() => {
    if (open) {
      place();
      const t = setTimeout(() => setEnter(true), 10);
      return () => clearTimeout(t);
    }
    setEnter(false);
    setActive(-1);
  }, [open, place]);
  React.useEffect(() => {
    if (open && pos && window.lucide) {
      window.lucide.createIcons();
      const t = setTimeout(() => window.lucide.createIcons(), 40);
      return () => clearTimeout(t);
    }
  }, [open, pos]);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => {
          const n = actionable.indexOf(a);
          return actionable[Math.min(actionable.length - 1, n + 1)] ?? actionable[0];
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => {
          const n = actionable.indexOf(a);
          return actionable[Math.max(0, n - 1)] ?? actionable[actionable.length - 1];
        });
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        choose(items[active]);
      }
    };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, active, items, place]);
  const choose = (it) => {
    if (!it || it.disabled) return;
    setOpen(false);
    it.onSelect && it.onSelect();
    onAction && onAction(it.id ?? it.label);
  };
  const popCls = ["hv-menu__pop", "hv-menu__pop--fixed", side === "up" ? "hv-menu__pop--up" : ""].filter(Boolean).join(" ");
  const popover = open && pos && /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: popRef,
      className: popCls,
      role: "menu",
      "data-enter": enter,
      style: { position: "fixed", left: pos.left, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto", minWidth: pos.minWidth }
    },
    items.map((it, i) => {
      if (it.type === "separator") return /* @__PURE__ */ React.createElement("div", { key: `s${i}`, className: "hv-menu__sep", role: "separator" });
      if (it.type === "heading") return /* @__PURE__ */ React.createElement("div", { key: `h${i}`, className: "hv-menu__heading" }, it.label);
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: it.id ?? i,
          type: "button",
          role: "menuitem",
          disabled: it.disabled,
          className: ["hv-menu__item", it.danger ? "hv-menu__item--danger" : ""].filter(Boolean).join(" "),
          "data-active": i === active,
          onMouseEnter: () => setActive(i),
          onClick: () => choose(it)
        },
        it.icon && /* @__PURE__ */ React.createElement("span", { className: "hv-menu__ico" }, it.icon),
        /* @__PURE__ */ React.createElement("span", { className: "hv-menu__label" }, it.label),
        it.shortcut && /* @__PURE__ */ React.createElement("span", { className: "hv-menu__shortcut" }, it.shortcut)
      );
    })
  );
  if (responsive && isMobile) {
    const acoes = items.filter((it) => it.type !== "separator" && it.type !== "heading").map((it, i) => ({
      id: it.id || String(i),
      label: it.label,
      icon: it.icon,
      danger: it.danger,
      disabled: it.disabled,
      onSelect: () => {
        if (it.onSelect) it.onSelect(it.id);
        if (onAction) onAction(it.id);
      }
    }));
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: ["hv-menu", className].filter(Boolean).join(" "), ref: rootRef }, /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "hv-menu__trigger",
        onClick: () => setOpen(true),
        style: { display: "inline-flex" }
      },
      trigger
    )), /* @__PURE__ */ React.createElement(
      ActionSheet,
      {
        open,
        onClose: () => setOpen(false),
        title: sheetTitle,
        items: acoes,
        container
      }
    ));
  }
  return /* @__PURE__ */ React.createElement("span", { className: ["hv-menu", className].filter(Boolean).join(" "), ref: rootRef }, /* @__PURE__ */ React.createElement("span", { className: "hv-menu__trigger", onClick: () => setOpen((o) => !o), style: { display: "inline-flex" } }, trigger), typeof document !== "undefined" ? popover && createPortal(popover, document.body) : popover);
}
export {
  Menu
};
