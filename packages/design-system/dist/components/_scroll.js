const SCROLL_CSS = `
.hv-scroll { scrollbar-width: thin; scrollbar-color: var(--ink-300) transparent; }
.hv-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.hv-scroll::-webkit-scrollbar-track { background: transparent; }
.hv-scroll::-webkit-scrollbar-thumb {
  background: var(--ink-200);
  border: 3px solid transparent;
  border-radius: var(--radius-pill);
  background-clip: content-box;
}
.hv-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-300); background-clip: content-box; }
.hv-scroll--brand { scrollbar-color: var(--petrol-700) transparent; }
.hv-scroll--brand::-webkit-scrollbar-thumb { background: var(--petrol-700); background-clip: content-box; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-scroll-css")) {
  const el = document.createElement("style");
  el.id = "hv-scroll-css";
  el.textContent = SCROLL_CSS;
  document.head.appendChild(el);
}
