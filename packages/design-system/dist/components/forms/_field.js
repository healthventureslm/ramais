const FIELD_CSS = `
.hv-field { display: flex; flex-direction: column; gap: 6px; font-family: var(--font-sans); }
.hv-field__label {
  font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-strong);
  display: flex; align-items: center; gap: 6px;
}
.hv-field__req { color: var(--field-required); }
.hv-field__hint { font-size: var(--text-xs); color: var(--text-muted); }
.hv-field__error { font-size: var(--text-xs); color: var(--danger-fg); display: flex; align-items: center; gap: var(--space-1); }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-field-css")) {
  const el = document.createElement("style");
  el.id = "hv-field-css";
  el.textContent = FIELD_CSS;
  document.head.appendChild(el);
}
