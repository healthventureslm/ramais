import React from "react";
const CSS = `
.hv-bubble { display: flex; gap: 10px; align-items: flex-end; font-family: var(--font-sans); margin-bottom: var(--space-3); }
.hv-bubble:last-child { margin-bottom: 0; }
.hv-bubble--user { flex-direction: row-reverse; }
.hv-bubble--system { justify-content: center; }

.hv-bubble__avatar { flex: none; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font: var(--weight-semibold) 12px var(--font-display); }
.hv-bubble--assistant .hv-bubble__avatar { background: var(--petrol-100); color: var(--petrol-700); }
.hv-bubble--user .hv-bubble__avatar { background: var(--sand-300); color: var(--ink-700); }
.hv-bubble__avatar svg { width: 16px; height: 16px; }

.hv-bubble__meta { font-size: var(--text-2xs); color: var(--text-muted); margin-bottom: 3px; }
.hv-bubble--user .hv-bubble__meta { text-align: right; }

.hv-bubble__body { max-width: 100%; padding: 9px 13px; border-radius: 14px; font-size: var(--text-sm);
  line-height: var(--leading-normal); white-space: pre-wrap; word-break: break-word; }
.hv-bubble--assistant .hv-bubble__body { background: var(--surface-raised); color: var(--text-strong); border: 1px solid var(--border-subtle); border-bottom-left-radius: 4px; }
.hv-bubble--user .hv-bubble__body { background: var(--petrol-500); color: var(--action-primary-text); border-bottom-right-radius: 4px; }
.hv-bubble--system .hv-bubble__body { background: transparent; color: var(--text-muted); font-size: var(--text-xs); text-align: center; padding: 2px 0; }
.hv-bubble__col { display: flex; flex-direction: column; max-width: 78%; min-width: 0; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-bubble-css")) {
  const el = document.createElement("style");
  el.id = "hv-bubble-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props });
const RascunhoIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M4 20h4l10-10-4-4L4 16z" }), /* @__PURE__ */ React.createElement("path", { d: "M14.5 5.5l4 4" }));
const UserIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ React.createElement("path", { d: "M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" }));
function ChatBubble({ role = "assistant", avatar, name, time, showAvatar = true, className = "", children, ...rest }) {
  if (role === "system") {
    return /* @__PURE__ */ React.createElement("div", { className: ["hv-bubble", "hv-bubble--system", className].filter(Boolean).join(" "), ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-bubble__body" }, children));
  }
  const av = avatar !== void 0 ? avatar : role === "user" ? UserIcon : RascunhoIcon;
  const meta = name != null || time != null;
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-bubble", `hv-bubble--${role}`, className].filter(Boolean).join(" "), ...rest }, showAvatar && /* @__PURE__ */ React.createElement("span", { className: "hv-bubble__avatar" }, av), /* @__PURE__ */ React.createElement("div", { className: "hv-bubble__col" }, meta && /* @__PURE__ */ React.createElement("div", { className: "hv-bubble__meta" }, name, name != null && time != null ? " \xB7 " : "", time), /* @__PURE__ */ React.createElement("div", { className: "hv-bubble__body" }, children)));
}
export {
  ChatBubble
};
