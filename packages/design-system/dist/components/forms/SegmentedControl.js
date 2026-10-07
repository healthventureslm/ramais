import React from "react";
const CSS = `
.hv-segmented { display: inline-flex; align-items: stretch; background: var(--surface-sunken);
  border-radius: var(--radius-md); padding: 3px; gap: 2px; font-family: var(--font-sans); position: relative;
  border: var(--border-hair) solid var(--border-subtle);
  /* inline-flex NAO garante largura natural. Como item de um flex column \u2014
     que e exatamente como um formulario empilha campos \u2014 o elemento e
     esticado no eixo cruzado e o inline-flex blockifica para flex. O
     controle virava uma caixa de 420px com as opcoes somando 196: nem o modo
     inline, nem o block, um terceiro estado sem nome com 224px de vazio a
     direita. fit-content segura a largura intrinseca mesmo esticado, e o
     --block abaixo continua vencendo com width: 100%. */
  width: fit-content; }
.hv-segmented--block { display: flex; width: 100%; }
.hv-segmented--block .hv-segmented__opt { flex: 1; }
.hv-segmented--lg { padding: var(--space-1); }

.hv-segmented__opt { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  border: none; background: transparent; cursor: pointer; white-space: nowrap;
  font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-muted);
  padding: 7px 14px; border-radius: var(--radius-sm); transition: color var(--dur-fast) var(--ease-standard); }
.hv-segmented--lg .hv-segmented__opt { font-size: var(--text-md); padding: 9px 18px; }
.hv-segmented__opt:hover:not(.hv-segmented__opt--active):not(:disabled) { color: var(--text-strong); }
.hv-segmented__opt:active:not(.hv-segmented__opt--active):not(:disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-segmented__opt--active { color: var(--brand-soft-fg); font-weight: var(--weight-semibold); }
.hv-segmented__opt:disabled { color: var(--state-disabled-fg); cursor: not-allowed; }
.hv-segmented__opt:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-segmented__opt svg { width: 16px; height: 16px; }
.hv-segmented__opt .hv-segmented__count { font-family: var(--font-mono); font-size: 11px; }

.hv-segmented__glider { position: absolute; z-index: 0; top: 3px; bottom: 3px; background: var(--surface-card);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-sm);
  transition: left var(--dur-normal) var(--ease-soft), width var(--dur-normal) var(--ease-soft); }
.hv-segmented--lg .hv-segmented__glider { top: 4px; bottom: 4px; }
@media (prefers-reduced-motion: reduce) { .hv-segmented__glider { transition: none; } }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-segmented-css")) {
  const el = document.createElement("style");
  el.id = "hv-segmented-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const norm = (o) => typeof o === "string" ? { value: o, label: o } : o;
const TONE = {
  positive: { bg: "var(--emerald-500)", fg: "var(--text-on-accent)" },
  danger: { bg: "var(--coral-500)", fg: "var(--text-on-accent)" },
  warning: { bg: "var(--amber-500)", fg: "var(--text-on-accent)" },
  neutral: { bg: "var(--ink-400)", fg: "var(--text-on-accent)" },
  info: { bg: "var(--petrol-500)", fg: "var(--action-primary-text)" }
};
function SegmentedControl({
  options = [],
  value,
  defaultValue,
  onChange,
  size = "md",
  block = false,
  disabled = false,
  className = "",
  ...rest
}) {
  const opts = options.map(norm);
  const controlled = value !== void 0;
  const [internal, setInternal] = React.useState(defaultValue ?? (opts[0] && opts[0].value));
  const current = controlled ? value : internal;
  const rootRef = React.useRef(null);
  const [glider, setGlider] = React.useState(null);
  const measure = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = root.querySelector(".hv-segmented__opt--active");
    if (!active) {
      setGlider(null);
      return;
    }
    setGlider({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);
  React.useLayoutEffect(() => {
    measure();
  }, [current, measure, options]);
  React.useEffect(() => {
    const raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 60);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    const onR = () => measure();
    window.addEventListener("resize", onR);
    let ro;
    if (rootRef.current && "ResizeObserver" in window) {
      ro = new ResizeObserver(measure);
      ro.observe(rootRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", onR);
      ro && ro.disconnect();
    };
  }, [measure]);
  const pick = (v) => {
    if (disabled) return;
    if (!controlled) setInternal(v);
    onChange && onChange(v);
  };
  const activeOpt = opts.find((o) => o.value === current);
  const activeTone = activeOpt && activeOpt.tone ? TONE[activeOpt.tone] : null;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: rootRef,
      className: ["hv-segmented", `hv-segmented--${size === "lg" ? "lg" : "md"}`, block ? "hv-segmented--block" : "", className].filter(Boolean).join(" "),
      role: "tablist",
      ...rest
    },
    glider && /* @__PURE__ */ React.createElement("span", { className: "hv-segmented__glider", style: { left: glider.left, width: glider.width, background: activeTone ? activeTone.bg : void 0 }, "aria-hidden": "true" }),
    opts.map((o) => {
      const active = o.value === current;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: o.value,
          type: "button",
          role: "tab",
          "aria-selected": active,
          disabled: o.disabled || disabled,
          className: ["hv-segmented__opt", active ? "hv-segmented__opt--active" : ""].filter(Boolean).join(" "),
          style: active && activeTone ? { color: activeTone.fg } : void 0,
          onClick: () => pick(o.value)
        },
        o.icon,
        o.label,
        o.count != null && /* @__PURE__ */ React.createElement("span", { className: "hv-segmented__count" }, o.count)
      );
    })
  );
}
export {
  SegmentedControl
};
