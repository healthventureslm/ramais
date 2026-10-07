const DATEFIELD_CSS = `
.hv-date { position: relative; font-family: var(--font-sans); }

/* Controle em forma de bot\xE3o: DateTimePicker e DateRangePicker, que abrem o
   popover e n\xE3o se digitam. O DatePicker tem o seu pr\xF3prio, com <input>. */
.hv-date__control {
  display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box;
  background: var(--surface-card); border: var(--border-hair) solid var(--border-control);
  border-radius: var(--radius-md); height: 40px; padding: 0 10px 0 var(--space-3); cursor: pointer; text-align: left;  /* @escala-livre: contrato de 13,0px de inicio de conteudo e 40px de altura entre Input, Select, Combobox, MultiSelect e DatePicker. Cada um chega la por padding diferente porque a estrutura interna e diferente; medido em tests/forms-playground.html. */
  font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-strong);
  transition: var(--transition-colors), box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-date__control:hover:not(:disabled):not([data-invalid]) { border-color: var(--border-control-hover); }
.hv-date[data-open="true"] .hv-date__control:not([data-invalid]) { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
/* Compartilhado por DateRangePicker e DateTimePicker: nenhum dos dois
   sinalizava erro no controle, so na mensagem. */
.hv-date__control[data-invalid="true"] { border-color: var(--danger-border); }
.hv-date__control[data-invalid="true"]:focus-visible { outline: none; box-shadow: var(--shadow-focus-danger); }
.hv-date__control:disabled { background: var(--surface-sunken); color: var(--text-muted); cursor: not-allowed; }
.hv-date__lead { flex: none; color: var(--text-subtle); display: inline-flex; }
.hv-date__lead svg { width: 17px; height: 17px; }
.hv-date__txt { flex: 1; }
.hv-date__txt--ph { color: var(--text-subtle); }

.hv-date__pop {
  position: fixed; z-index: 200; width: 296px; box-sizing: border-box;
  background: var(--surface-float); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 14px;
  opacity: 1; transform: translateY(0) scale(1); transform-origin: top center;
  transition: transform var(--dur-fast) var(--ease-entrance);
}
.hv-date__pop[data-enter="false"] { transform: translateY(-6px) scale(0.985); }

.hv-date__foot { display: flex; justify-content: space-between; align-items: center; gap: 6px;
  margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-subtle); }
.hv-date__quick { border: none; background: transparent; cursor: pointer; font: 500 var(--text-sm) var(--font-sans);
  color: var(--petrol-700); padding: 5px 9px; border-radius: var(--radius-sm); transition: var(--transition-colors); }
.hv-date__quick:hover { background: var(--state-brand-hover); }
.hv-date__quick:active { background: var(--state-brand-press); transition-duration: 0s; }
.hv-date__quick:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: 1px; }

/* Dedo: 40px fica abaixo do --tap-min que o resto do DS respeita, e desde
   que os botoes passaram a crescer em ponteiro grosso o formulario ficava
   com campo de 40 e botao de 44 na mesma tela. Cresce so onde ha dedo. */
@media (pointer: coarse) {
  .hv-date__control { height: var(--tap-min); }
}

/* A entrada do popover e geometria. Com menos movimento ele aparece ja no
   lugar, so por opacidade. */
@media (prefers-reduced-motion: reduce) {
  .hv-date__pop { transition: opacity var(--dur-fast) linear; }
  .hv-date__pop[data-enter="false"] { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-date-css")) {
  const el = document.createElement("style");
  el.id = "hv-date-css";
  el.textContent = DATEFIELD_CSS;
  document.head.appendChild(el);
}
