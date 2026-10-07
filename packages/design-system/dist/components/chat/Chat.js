import React from "react";
import { Tag } from "../data-display/Tag.js";
const CSS = `
.hv-chat {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--surface-canvas); font-family: var(--font-sans); color: var(--text-body);
  border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden;
}
.hv-chat--split { flex-direction: row; }
.hv-chat__main { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }

.hv-chat__header { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-subtle); background: var(--surface-card); }
.hv-chat__headinfo { min-width: 0; }
.hv-chat__headextra { flex: none; display: flex; align-items: center; gap: var(--space-2); }
.hv-chat__title { font: var(--weight-bold) var(--text-md)/1.2 var(--font-display); color: var(--text-strong); }
.hv-chat__subtitle { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }

.hv-chat__log { flex: 1; overflow-y: auto; min-height: 0; padding: var(--space-4); display: flex; flex-direction: column; }
.hv-chat__empty { margin: auto; text-align: center; color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-6); }

.hv-chat__msg { display: flex; gap: 10px; margin-bottom: var(--space-3); align-items: flex-end; }
.hv-chat__msg--user { flex-direction: row-reverse; }
.hv-chat__msg--system { justify-content: center; }

.hv-chat__avatar { flex: none; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font: var(--weight-semibold) 12px var(--font-display); }
.hv-chat__avatar--assistant { background: var(--petrol-100); color: var(--petrol-700); }
.hv-chat__avatar--user { background: var(--sand-300); color: var(--ink-700); }
.hv-chat__avatar svg { width: 16px; height: 16px; }

.hv-chat__bubble { max-width: 78%; padding: 9px 13px; border-radius: 14px; font-size: var(--text-sm);
  line-height: var(--leading-normal); white-space: pre-wrap; word-break: break-word; }
.hv-chat__msg--assistant .hv-chat__bubble { background: var(--surface-raised); color: var(--text-strong); border: 1px solid var(--border-subtle); border-bottom-left-radius: 4px; }
.hv-chat__msg--user .hv-chat__bubble { background: var(--petrol-500); color: var(--action-primary-text); border-bottom-right-radius: 4px; }
.hv-chat__msg--system .hv-chat__bubble { background: transparent; color: var(--text-muted); font-size: var(--text-xs); text-align: center; max-width: 100%; padding: 2px 0; }

.hv-chat__atts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-2); }
.hv-chat__att { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2); background: var(--surface-card); border: 1px solid var(--border-subtle); color: var(--text-body); max-width: 180px; }
.hv-chat__msg--user .hv-chat__att { background: var(--veil-fill); border-color: var(--veil-edge); color: var(--action-primary-text); }
.hv-chat__att svg { width: 14px; height: 14px; flex: none; }
.hv-chat__att span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-chat__att-img { width: 100%; max-width: 200px; border-radius: var(--radius-md); display: block; margin-top: var(--space-2); border: 1px solid var(--border-subtle); }

.hv-chat__typing { display: inline-flex; gap: var(--space-1); align-items: center; padding: var(--space-3) 14px; }
.hv-chat__typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--text-subtle); animation: hv-chat-blink 1.2s infinite ease-in-out; }
.hv-chat__typing span:nth-child(2) { animation-delay: 0.18s; }
.hv-chat__typing span:nth-child(3) { animation-delay: 0.36s; }
@keyframes hv-chat-blink { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .hv-chat__typing span { animation: none; opacity: 0.6; } }

.hv-chat__cursor { display: inline-block; width: 7px; height: 1.05em; margin-left: 2px; vertical-align: text-bottom;
  background: var(--petrol-500); border-radius: 1px; animation: hv-chat-cursor 1.05s steps(2, start) infinite; }
.hv-chat__msg--user .hv-chat__cursor { background: var(--action-primary-text); }
@keyframes hv-chat-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .hv-chat__cursor { animation: none; opacity: 0.7; } }

.hv-chat__suggest { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0 var(--space-3) 10px; }
/* Caixa de digitacao e chips sao limites de CONTROLE: valem os mesmos
   3:1 dos campos de formulario. Ficaram de fora daquela migracao
   porque a varredura foi por pasta (components/forms/), e o chat
   nao mora la. --border-default media 1,42:1. */
.hv-chat__chip { border: 1px solid var(--border-control); background: var(--surface-card); border-radius: var(--radius-pill);
  padding: 5px var(--space-3); font-size: var(--text-xs); color: var(--text-body); cursor: pointer; font-family: var(--font-sans);
  transition: var(--transition-colors); }
.hv-chat__chip:hover:not(:disabled) { background: var(--state-brand-hover); border-color: var(--petrol-300); color: var(--petrol-700); }
.hv-chat__chip:active:not(:disabled) { background: var(--state-brand-press); transition-duration: 0s; }
.hv-chat__chip:disabled { background: var(--surface-card); color: var(--state-disabled-fg);
  border-color: var(--state-disabled-bd); cursor: not-allowed; }

.hv-chat__composer { flex: none; border-top: 1px solid var(--border-subtle); padding: 10px var(--space-3); background: var(--surface-card); }
.hv-chat__files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-2); }
.hv-chat__inputrow { display: flex; align-items: flex-end; gap: 6px; border: 1px solid var(--border-control); border-radius: var(--radius-lg);
  padding: var(--space-1) var(--space-1) var(--space-1) 6px; background: var(--surface-card); transition: border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard); }
.hv-chat__inputrow:focus-within { border-color: var(--border-brand); box-shadow: var(--shadow-focus); }
.hv-chat__input { flex: 1; resize: none; border: none; background: transparent; outline: none; color: var(--text-strong);
  font: var(--weight-regular) var(--text-sm)/1.45 var(--font-sans); padding: 7px var(--space-1); max-height: 140px; }
.hv-chat__input::placeholder { color: var(--text-subtle); }
.hv-chat__iconbtn { flex: none; width: 34px; height: 34px; border: none; background: transparent; color: var(--text-muted);
  border-radius: var(--radius-md); cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: var(--transition-colors); }
.hv-chat__iconbtn:hover:not(:disabled) { background: var(--state-hover); color: var(--text-body); }
.hv-chat__iconbtn:active:not(:disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-chat__iconbtn svg { width: 18px; height: 18px; display: block; }
.hv-chat__send { background: var(--action-primary); color: var(--action-primary-text); }
.hv-chat__send:hover:not(:disabled) { background: var(--action-primary-hover); color: var(--action-primary-text); }
.hv-chat__send:active:not(:disabled) { background: var(--action-primary-press); transition-duration: 0s; }
/* O botao de enviar carrega as DUAS classes (__iconbtn __send), entao a
   regra generica vem primeiro e a preenchida por cima \u2014 mesmo peso, quem
   vence e a ordem. */
.hv-chat__iconbtn:disabled { color: var(--state-disabled-fg); cursor: not-allowed; }
.hv-chat__send:disabled { background: var(--state-disabled-bg); color: var(--state-disabled-fg); }
.hv-chat__iconbtn:focus-visible, .hv-chat__chip:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
/* 34px e alvo de mouse; no dedo, --tap-min, como o resto do sistema. */
@media (pointer: coarse) {
  .hv-chat__iconbtn { width: var(--tap-min); height: var(--tap-min); }
}

.hv-chat__aside { flex: none; width: 42%; max-width: 460px; min-width: 240px; border-left: 1px solid var(--border-subtle);
  background: var(--surface-card); overflow: auto; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-chat-css")) {
  const el = document.createElement("style");
  el.id = "hv-chat-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Svg = (props) => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props });
const RascunhoIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M4 20h4l10-10-4-4L4 16z" }), /* @__PURE__ */ React.createElement("path", { d: "M14.5 5.5l4 4" }));
const UserIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ React.createElement("path", { d: "M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" }));
const PaperclipIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }));
const CameraIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "13", r: "3" }));
const SendIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M22 2 11 13" }), /* @__PURE__ */ React.createElement("path", { d: "M22 2 15 22l-4-9-9-4z" }));
const FileIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), /* @__PURE__ */ React.createElement("path", { d: "M14 2v6h6" }));
const XIcon = /* @__PURE__ */ React.createElement(Svg, null, /* @__PURE__ */ React.createElement("path", { d: "M18 6 6 18" }), /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12" }));
function Attachment({ att }) {
  const isImg = att.type && att.type.indexOf("image") === 0 && att.url;
  if (isImg) return /* @__PURE__ */ React.createElement("img", { className: "hv-chat__att-img", src: att.url, alt: att.name || "" });
  return /* @__PURE__ */ React.createElement("span", { className: "hv-chat__att" }, FileIcon, /* @__PURE__ */ React.createElement("span", null, att.name || "arquivo"));
}
function Chat({
  messages = [],
  onSend,
  onSuggestion,
  pending = false,
  streaming = false,
  busy = false,
  suggestions,
  attachments = false,
  accept = "image/*,application/pdf",
  capture = false,
  onCapture,
  composerActions,
  placeholder = "Escreva uma mensagem\u2026",
  title,
  subtitle,
  assistantAvatar = RascunhoIcon,
  userAvatar = UserIcon,
  headerExtra,
  aside,
  emptyState,
  className = "",
  ...rest
}) {
  const logRef = React.useRef(null);
  const taRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const captureRef = React.useRef(null);
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState([]);
  const captureMode = capture === true ? "environment" : capture;
  const lastIdx = messages.length - 1;
  const lastContent = lastIdx >= 0 ? messages[lastIdx].content : null;
  const streamTick = typeof lastContent === "string" ? lastContent.length : 0;
  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending, streaming, streamTick]);
  const canSend = (text.trim() !== "" || files.length > 0) && !busy;
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
  const addFiles = (list) => {
    const picked = Array.from(list || []);
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
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
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const actionsApi = { busy, addFiles, openFilePicker: () => fileRef.current && fileRef.current.click() };
  const clickSuggestion = (s) => {
    if (busy) return;
    if (onSuggestion) onSuggestion(s);
    else onSend && onSend(s.value != null ? s.value : s.label, []);
  };
  const isEmpty = messages.length === 0 && !pending;
  const cls = ["hv-chat", aside ? "hv-chat--split" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { className: cls, ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-chat__main" }, (title || subtitle || headerExtra) && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__header" }, /* @__PURE__ */ React.createElement("div", { className: "hv-chat__headinfo" }, title && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__subtitle" }, subtitle)), headerExtra && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__headextra" }, headerExtra)), /* @__PURE__ */ React.createElement("div", { className: "hv-chat__log", ref: logRef, role: "log", "aria-live": "polite", "aria-busy": pending || busy }, isEmpty && emptyState && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__empty" }, emptyState), messages.map((m, i) => {
    const role = m.role || "assistant";
    if (role === "system") {
      return /* @__PURE__ */ React.createElement("div", { key: m.id != null ? m.id : i, className: "hv-chat__msg hv-chat__msg--system" }, /* @__PURE__ */ React.createElement("div", { className: "hv-chat__bubble" }, m.content));
    }
    return /* @__PURE__ */ React.createElement("div", { key: m.id != null ? m.id : i, className: `hv-chat__msg hv-chat__msg--${role}` }, /* @__PURE__ */ React.createElement("span", { className: `hv-chat__avatar hv-chat__avatar--${role}` }, role === "user" ? userAvatar : assistantAvatar), /* @__PURE__ */ React.createElement("div", { className: "hv-chat__bubble" }, m.content, streaming && i === lastIdx && role === "assistant" && /* @__PURE__ */ React.createElement("span", { className: "hv-chat__cursor", "aria-hidden": "true" }), m.attachments && m.attachments.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__atts" }, m.attachments.map((att, ai) => /* @__PURE__ */ React.createElement(Attachment, { key: ai, att })))));
  }), pending && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__msg hv-chat__msg--assistant" }, /* @__PURE__ */ React.createElement("span", { className: "hv-chat__avatar hv-chat__avatar--assistant" }, assistantAvatar), /* @__PURE__ */ React.createElement("div", { className: "hv-chat__bubble", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("span", { className: "hv-chat__typing", "aria-label": "Assistente est\xE1 digitando" }, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", null))))), suggestions && suggestions.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__suggest" }, suggestions.map((s, i) => /* @__PURE__ */ React.createElement("button", { key: i, type: "button", className: "hv-chat__chip", disabled: busy, onClick: () => clickSuggestion(s) }, s.label))), /* @__PURE__ */ React.createElement("form", { className: "hv-chat__composer", onSubmit: (e) => {
    e.preventDefault();
    submit();
  } }, files.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__files" }, files.map((f, i) => /* @__PURE__ */ React.createElement(Tag, { key: i, icon: FileIcon, onRemove: () => removeFile(i) }, f.name))), /* @__PURE__ */ React.createElement("div", { className: "hv-chat__inputrow" }, attachments && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-chat__iconbtn", "aria-label": "Anexar arquivo", disabled: busy, onClick: () => fileRef.current && fileRef.current.click() }, PaperclipIcon), /* @__PURE__ */ React.createElement("input", { ref: fileRef, type: "file", accept, multiple: true, hidden: true, onChange: handleFiles })), capture && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-chat__iconbtn", "aria-label": "Tirar foto", disabled: busy, onClick: () => captureRef.current && captureRef.current.click() }, CameraIcon), /* @__PURE__ */ React.createElement("input", { ref: captureRef, type: "file", accept: "image/*", capture: captureMode, hidden: true, onChange: handleCapture })), composerActions && (typeof composerActions === "function" ? composerActions(actionsApi) : composerActions), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      ref: taRef,
      className: "hv-chat__input",
      rows: 1,
      value: text,
      placeholder,
      disabled: busy,
      onChange: handleInput,
      onKeyDown: handleKeyDown,
      "aria-label": "Mensagem"
    }
  ), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "hv-chat__iconbtn hv-chat__send", "aria-label": "Enviar", disabled: !canSend }, SendIcon)))), aside && /* @__PURE__ */ React.createElement("div", { className: "hv-chat__aside" }, aside));
}
export {
  Chat
};
