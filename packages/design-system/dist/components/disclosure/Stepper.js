import React from "react";
const CSS = `
.hv-stepper { font-family: var(--font-sans); }

/* ---- Horizontal ---- */
.hv-stepper--h { display: flex; align-items: flex-start; }
.hv-stepper--h .hv-step { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; min-width: 0; }
.hv-stepper--h .hv-step__connector { position: absolute; top: 15px; height: 2px; left: 50%; right: -50%;
  background: var(--border-default); z-index: 0; }
.hv-stepper--h .hv-step:last-child .hv-step__connector { display: none; }
.hv-stepper--h .hv-step[data-state="done"] .hv-step__connector { background: var(--petrol-500); }
.hv-step__label-wrap { display: block; }
.hv-stepper--h .hv-step__label-wrap { margin-top: 9px; padding: 0 6px; }

/* ---- Vertical ---- */
.hv-stepper--v { display: flex; flex-direction: column; }
.hv-stepper--v .hv-step { display: flex; gap: 14px; position: relative; }
.hv-stepper--v .hv-step__connector { position: absolute; left: 15px; top: 32px; bottom: -6px; width: 2px;
  background: var(--border-default); }
.hv-stepper--v .hv-step:last-child .hv-step__connector { display: none; }
.hv-stepper--v .hv-step[data-state="done"] .hv-step__connector { background: var(--petrol-500); }
.hv-stepper--v .hv-step__label-wrap { padding: var(--space-1) 0 22px; }
.hv-stepper--v .hv-step:last-child .hv-step__label-wrap { padding-bottom: 0; }

/* ---- Marker (shared) ---- */
.hv-step--clickable:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-sm); }
.hv-step__marker { position: relative; z-index: 1; flex: none; width: 32px; height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
  font: 600 var(--text-sm)/1 var(--font-mono); background: var(--surface-card);
  border: 2px solid var(--border-strong); color: var(--text-muted);
  transition: var(--transition-colors), box-shadow var(--dur-normal) var(--ease-standard); }
.hv-step__marker svg { width: 16px; height: 16px; }
.hv-step[data-state="done"] .hv-step__marker { background: var(--petrol-500); border-color: var(--petrol-500); color: var(--action-primary-text); }
.hv-step[data-state="current"] .hv-step__marker { border-color: var(--petrol-500); color: var(--petrol-700);
  background: var(--petrol-50); box-shadow: 0 0 0 4px var(--petrol-100); }
.hv-step[data-state="error"] .hv-step__marker { background: var(--crimson-600); border-color: var(--crimson-600); color: var(--action-danger-text); }
.hv-step--clickable { cursor: pointer; }
.hv-step--clickable:hover .hv-step__marker { border-color: var(--petrol-400); }

.hv-step__num { display: inline-flex; }
.hv-step__title { display: block; font: 600 var(--text-md)/1.3 var(--font-sans); color: var(--text-muted); transition: var(--transition-colors); }
.hv-step[data-state="done"] .hv-step__title, .hv-step[data-state="current"] .hv-step__title { color: var(--text-strong); }
.hv-step[data-state="error"] .hv-step__title { color: var(--crimson-700); }
.hv-step__desc { display: block; font: var(--text-xs)/1.4 var(--font-sans); color: var(--text-muted); margin-top: 3px; }
.hv-stepper--h .hv-step__title { font-size: var(--text-sm); }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-stepper-css")) {
  const el = document.createElement("style");
  el.id = "hv-stepper-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Check = () => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M20 6 9 17l-5-5" }));
const Bang = () => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.6", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M12 8v4" }), /* @__PURE__ */ React.createElement("path", { d: "M12 16h.01" }));
function Stepper({ steps = [], current = 0, orientation = "horizontal", onStepClick, className = "", ...rest }) {
  const isH = orientation !== "vertical";
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: ["hv-stepper", isH ? "hv-stepper--h" : "hv-stepper--v", className].filter(Boolean).join(" "),
      role: "list",
      "aria-label": "Progresso",
      ...rest
    },
    steps.map((s, i) => {
      const state = s.state || (i < current ? "done" : i === current ? "current" : "upcoming");
      const clickable = !!onStepClick && (state === "done" || state === "current");
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          className: ["hv-step", clickable ? "hv-step--clickable" : ""].filter(Boolean).join(" "),
          "data-state": state,
          role: "listitem",
          key: s.id ?? i,
          onClick: clickable ? () => onStepClick(i) : void 0,
          tabIndex: clickable ? 0 : void 0,
          onKeyDown: clickable ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStepClick(i);
            }
          } : void 0,
          "aria-current": state === "current" ? "step" : void 0
        },
        /* @__PURE__ */ React.createElement("span", { className: "hv-step__connector", "aria-hidden": "true" }),
        /* @__PURE__ */ React.createElement("span", { className: "hv-step__marker" }, state === "done" ? /* @__PURE__ */ React.createElement(Check, null) : state === "error" ? /* @__PURE__ */ React.createElement(Bang, null) : s.icon || /* @__PURE__ */ React.createElement("span", { className: "hv-step__num" }, i + 1)),
        /* @__PURE__ */ React.createElement("span", { className: "hv-step__label-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "hv-step__title" }, s.title), s.description && /* @__PURE__ */ React.createElement("span", { className: "hv-step__desc" }, s.description))
      );
    })
  );
}
export {
  Stepper
};
