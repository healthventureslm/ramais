import React from "react";
import { Tag } from "../data-display/Tag.js";
const CSS = `
.hv-composer { font-family: var(--font-sans); }
.hv-composer__suggest { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-2); }
/* Caixa de digitacao e chips sao limites de CONTROLE: valem os mesmos
   3:1 dos campos de formulario. Ficaram de fora daquela migracao
   porque a varredura foi por pasta (components/forms/), e o chat
   nao mora la. --border-default media 1,42:1. */
.hv-composer__chip { border: 1px solid var(--border-control); background: var(--surface-card); border-radius: var(--radius-pill);
  padding: 5px var(--space-3); font-size: var(--text-xs); color: var(--text-body); cursor: pointer; font-family: var(--font-sans); transition: var(--transition-colors); }
.hv-composer__chip:hover:not(:disabled) { background: var(--state-brand-hover); border-color: var(--petrol-300); color: var(--petrol-700); }
.hv-composer__chip:active:not(:disabled) { background: var(--state-brand-press); transition-duration: 0s; }
.hv-composer__chip:disabled { background: var(--surface-card); color: var(--state-disabled-fg);
  border-color: var(--state-disabled-bd); cursor: not-allowed; }

.hv-composer__files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-2); }
.hv-composer__row { display: flex; align-items: flex-end; gap: 6px; border: 1px solid var(--border-control); border-radius: var(--radius-lg);
  padding: var(--space-1) var(--space-1) var(--space-1) 6px; background: var(--surface-card);
  transition: border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard); }
.hv-composer__row:focus-within { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-composer__input { flex: 1; resize: none; border: none; background: transparent; outline: none; color: var(--text-strong);
  font: var(--weight-regular) var(--text-sm)/1.45 var(--font-sans); padding: 7px var(--space-1); max-height: 140px; }
.hv-composer__input::placeholder { color: var(--text-subtle); }
.hv-composer__btn { flex: none; width: 34px; height: 34px; border: none; background: transparent; color: var(--text-muted);
  border-radius: var(--radius-md); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: var(--transition-colors); }
.hv-composer__btn:hover:not(:disabled) { background: var(--state-hover); color: var(--text-body); }
.hv-composer__btn:active:not(:disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-composer__btn svg { width: 18px; height: 18px; display: block; }
.hv-composer__send { background: var(--action-primary); color: var(--action-primary-text); }
.hv-composer__send:hover:not(:disabled) { background: var(--action-primary-hover); color: var(--action-primary-text); }
.hv-composer__send:active:not(:disabled) { background: var(--action-primary-press); transition-duration: 0s; }
/* O botao de enviar carrega as DUAS classes (__btn __send), entao a regra
   generica vem primeiro e a preenchida por cima \u2014 mesmo peso, quem vence e
   a ordem. */
.hv-composer__btn:disabled { color: var(--state-disabled-fg); cursor: not-allowed; }
.hv-composer__send:disabled { background: var(--state-disabled-bg); color: var(--state-disabled-fg); }
.hv-composer__btn:focus-visible, .hv-composer__chip:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
@media (pointer: coarse) {
  .hv-composer__btn { width: var(--tap-min); height: var(--tap-min); }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-composer-css")) {
  const el = document.createElement("style");
  el.id = "hv-composer-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props });
const PaperclipIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }));
const CameraIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "13", r: "3" }));
const SendIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M22 2 11 13" }), /* @__PURE__ */ React.createElement("path", { d: "M22 2 15 22l-4-9-9-4z" }));
const FileIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), /* @__PURE__ */ React.createElement("path", { d: "M14 2v6h6" }));
const XIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18" }), /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12" }));
function ChatComposer({
  onSend,
  busy = false,
  attachments = false,
  accept = "image/*,application/pdf",
  capture = false,
  onCapture,
  composerActions,
  placeholder = "Escreva uma mensagem\u2026",
  suggestions,
  onSuggestion,
  autoFocus = false,
  className = "",
  ...rest
}) {
  const taRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const captureRef = React.useRef(null);
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState([]);
  const canSend = (text.trim() !== "" || files.length > 0) && !busy;
  const captureMode = capture === true ? "environment" : capture;
  const addFiles = (list) => {
    const picked = Array.from(list || []);
    if (picked.length) setFiles((p) => [...p, ...picked]);
  };
  const submit = () => {
    if (!canSend) return;
    onSend && onSend(text.trim(), files);
    setText("");
    setFiles([]);
    if (taRef.current) taRef.current.style.height = "auto";
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  const handleInput = (e) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  };
  const handleFiles = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };
  const handleCapture = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) {
      if (onCapture) onCapture(picked);
      else addFiles(picked);
    }
    e.target.value = "";
  };
  const removeFile = (idx) => setFiles((p) => p.filter((_, i) => i !== idx));
  const clickSuggestion = (s) => {
    if (busy) return;
    if (onSuggestion) onSuggestion(s);
    else onSend && onSend(s.value != null ? s.value : s.label, []);
  };
  const actionsApi = { busy, addFiles, openFilePicker: () => fileRef.current && fileRef.current.click() };
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-composer", className].filter(Boolean).join(" "), ...rest }, suggestions && suggestions.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-composer__suggest" }, suggestions.map((s, i) => /* @__PURE__ */ React.createElement("button", { key: i, type: "button", className: "hv-composer__chip", disabled: busy, onClick: () => clickSuggestion(s) }, s.label))), /* @__PURE__ */ React.createElement("form", { onSubmit: (e) => {
    e.preventDefault();
    submit();
  } }, files.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-composer__files" }, files.map((f, i) => /* @__PURE__ */ React.createElement(Tag, { key: i, icon: FileIcon, onRemove: () => removeFile(i) }, f.name))), /* @__PURE__ */ React.createElement("div", { className: "hv-composer__row" }, attachments && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-composer__btn", "aria-label": "Anexar arquivo", disabled: busy, onClick: () => fileRef.current && fileRef.current.click() }, PaperclipIcon), /* @__PURE__ */ React.createElement("input", { ref: fileRef, type: "file", accept, multiple: true, hidden: true, onChange: handleFiles })), capture && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-composer__btn", "aria-label": "Tirar foto", disabled: busy, onClick: () => captureRef.current && captureRef.current.click() }, CameraIcon), /* @__PURE__ */ React.createElement("input", { ref: captureRef, type: "file", accept: "image/*", capture: captureMode, hidden: true, onChange: handleCapture })), composerActions && (typeof composerActions === "function" ? composerActions(actionsApi) : composerActions), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      ref: taRef,
      className: "hv-composer__input",
      rows: 1,
      value: text,
      placeholder,
      disabled: busy,
      autoFocus,
      onChange: handleInput,
      onKeyDown: handleKeyDown,
      "aria-label": "Mensagem"
    }
  ), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "hv-composer__btn hv-composer__send", "aria-label": "Enviar", disabled: !canSend }, SendIcon))));
}
export {
  ChatComposer
};
