import React from "react";
const CSS = `
.hv-typing { display: inline-flex; gap: var(--space-1); align-items: center; padding: 10px var(--space-3);
  background: var(--surface-raised); border: 1px solid var(--border-subtle); border-radius: 14px; border-bottom-left-radius: 4px; }
.hv-typing--bare { background: transparent; border: none; padding: var(--space-1) 2px; }
.hv-typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--text-subtle); animation: hv-typing-blink 1.2s infinite ease-in-out; }
.hv-typing span:nth-child(2) { animation-delay: 0.18s; }
.hv-typing span:nth-child(3) { animation-delay: 0.36s; }
@keyframes hv-typing-blink { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .hv-typing span { animation: none; opacity: 0.6; } }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-typing-css")) {
  const el = document.createElement("style");
  el.id = "hv-typing-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function TypingIndicator({ label = "Digitando\u2026", bare = false, className = "", ...rest }) {
  const cls = ["hv-typing", bare ? "hv-typing--bare" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("span", { className: cls, role: "status", "aria-label": label, ...rest }, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null));
}
export {
  TypingIndicator
};
