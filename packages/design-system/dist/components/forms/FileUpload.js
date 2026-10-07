import React from "react";
import "./_field.js";
import { Input } from "./Input.js";
const CSS = `
.hv-upload { display: flex; flex-direction: column; gap: var(--space-2); font-family: var(--font-sans); }

.hv-upload__zone {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-2); text-align: center;
  padding: var(--space-6) var(--space-5); min-height: 132px; box-sizing: border-box;
  background-color: var(--surface-sunken);
  border: none; border-radius: var(--radius-lg);
  color: var(--text-muted); cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
/* O tracejado era um SVG em data: URI com o hex CRAVADO (#B2BBB5) \u2014 quatro
   URIs, um por estado. Hex dentro de string nao e alcancado por nenhuma
   auditoria e nao inverte no tema escuro: a borda ficava cinza-clara sobre
   canvas escuro, destoando de todo campo ao lado. Dois deles ainda usavam
   #1E8576, o petrol-500 de ANTES da correcao de contraste.
   Agora o SVG e so MASCARA (a cor dele nao importa, so o alfa) e quem pinta
   e o background-color do pseudo \u2014 entao o traco e um token, e cada estado
   troca uma variavel em vez de um arquivo inteiro. */
.hv-upload__zone::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  border-radius: inherit; background-color: var(--_dash, var(--border-control));
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Crect width='100%25' height='100%25' fill='none' rx='14' ry='14' stroke='%23fff' stroke-width='4' stroke-dasharray='7 7'/%3E%3C/svg%3E");
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Crect width='100%25' height='100%25' fill='none' rx='14' ry='14' stroke='%23fff' stroke-width='4' stroke-dasharray='7 7'/%3E%3C/svg%3E");
}
.hv-upload__zone:hover:not(.hv-upload__zone--disabled) {
  background-color: var(--sand-100); --_dash: var(--border-brand);
}
/* A zona inteira e o alvo de toque, e no celular ela e o unico jeito de anexar:
   sem press, o dedo nao tem nenhum retorno antes do seletor de arquivo abrir. */
.hv-upload__zone:active:not(.hv-upload__zone--disabled) {
  background-color: var(--sand-200); --_dash: var(--border-brand); transition-duration: 0s;
}
.hv-upload__zone:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-upload__zone--drag, .hv-upload__zone--drag:hover {
  background-color: var(--petrol-50, var(--sand-100)); box-shadow: var(--shadow-focus);
  --_dash: var(--border-brand);
}
/* Arrastando por cima, o traco fecha: vira contorno continuo. */
.hv-upload__zone--drag::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Crect width='100%25' height='100%25' fill='none' rx='14' ry='14' stroke='%23fff' stroke-width='4'/%3E%3C/svg%3E");
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Crect width='100%25' height='100%25' fill='none' rx='14' ry='14' stroke='%23fff' stroke-width='4'/%3E%3C/svg%3E");
}
.hv-upload__zone--invalid, .hv-upload__zone--invalid:hover { --_dash: var(--danger-border); }
/* Par desenhado, nao opacidade. Aqui o DS controla a cor de TODO o texto, que e
   a condicao que a isencao de opacidade nao cobre.

   Medido (claro, sobre --surface-card): --state-disabled-fg da 3,10:1 sempre.
   O opacity 0.5 dava de 2,26 a 3,28 no MESMO componente, porque o resultado
   depende da cor de partida \u2014 texto que comecava em --text-muted caia mais que
   texto que comecava em --text-strong. O ganho aqui e previsibilidade, nao
   contraste: nenhum dos dois alcanca 4,5, e o teto de qualquer opacity 0.5 e
   3,98 (preto puro). Ver a nota de contraste no DESIGN.md. */
.hv-upload__zone--disabled {
  cursor: not-allowed; background-color: var(--state-disabled-bg);
  color: var(--state-disabled-fg); --_dash: var(--state-disabled-bd);
}
/* O texto interno declara a PROPRIA cor (--text-strong no prompt, --petrol-700
   no destaque, --text-subtle no sub), entao herdar nao basta: sem estas linhas
   a zona desabilitada mantinha 15:1 e nao parecia desabilitada. Cada no que
   tem cor propria precisa ser apagado explicitamente \u2014 e esse custo por no e
   justamente a razao pela qual a isencao de opacidade existe onde o conteudo
   e do produto. Aqui o conteudo e do DS, entao da para enumerar. */
.hv-upload__zone--disabled .hv-upload__prompt,
.hv-upload__zone--disabled .hv-upload__prompt b,
.hv-upload__zone--disabled .hv-upload__sub,
.hv-upload__zone--disabled .hv-upload__icon { color: var(--state-disabled-fg); }

/* Era o glifo dentro de um CIRCULO de 44px com fundo e fio \u2014 o icone-em-
   circulo do catalogo de tells, a mesma peca que saiu do EmptyState. A zona
   tracejada ja e o alvo e o contorno; o glifo so precisa acompanhar a frase. */
.hv-upload__icon {
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--brand-soft-fg);
  transition: transform var(--dur-fast) var(--ease-standard);
}
.hv-upload__zone--drag .hv-upload__icon { transform: translateY(-2px); }
.hv-upload__icon svg { width: 24px; height: 24px; display: block; }

.hv-upload__prompt { font-size: var(--text-md); color: var(--text-strong); }
.hv-upload__prompt b { font-weight: var(--weight-semibold); color: var(--petrol-700); }
.hv-upload__sub { font-size: var(--text-xs); color: var(--text-muted); font-family: var(--font-mono); }

/* compact single-row variant */
.hv-upload__zone--compact {
  flex-direction: row; min-height: 0; padding: var(--space-3) var(--space-4);
  gap: var(--space-3); justify-content: flex-start; text-align: left;
}
.hv-upload__zone--compact .hv-upload__icon svg { width: 20px; height: 20px; }
.hv-upload__zone--compact .hv-upload__copy { display: flex; flex-direction: column; gap: 1px; }

/* file list */
.hv-upload__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.hv-upload__file {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); background: var(--surface-card);
  border: var(--border-hair) solid var(--border-subtle); border-radius: var(--radius-md);
}
.hv-upload__file--error { border-color: var(--danger-border); background: var(--danger-bg); }
.hv-upload__file-thumb {
  flex: none; display: inline-flex; align-items: center; justify-content: center; overflow: hidden;
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  background: var(--surface-sunken); color: var(--text-muted);
}
.hv-upload__file--done .hv-upload__file-thumb { color: var(--positive-fg); background: var(--positive-bg); }
.hv-upload__file--error .hv-upload__file-thumb { color: var(--danger-fg); background: var(--surface-card); }
.hv-upload__file-thumb svg { width: 18px; height: 18px; display: block; }
.hv-upload__file-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hv-upload__file-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.hv-upload__file-name {
  font-size: var(--text-sm); color: var(--text-strong); font-weight: var(--weight-medium);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hv-upload__file-info { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); }
.hv-upload__file-size { font-family: var(--font-mono); color: var(--text-muted); }
.hv-upload__file-status { color: var(--text-muted); }
.hv-upload__file--done .hv-upload__file-status { color: var(--positive-fg); }
.hv-upload__file--error .hv-upload__file-status { color: var(--danger-fg); }

.hv-upload__bar { height: 4px; border-radius: var(--radius-pill); background: var(--surface-sunken); overflow: hidden; }
.hv-upload__bar-fill {
  height: 100%; background: var(--petrol-600); border-radius: inherit;
  transition: width var(--dur-slow) var(--ease-standard);
}

.hv-upload__remove {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  background: transparent; border: none; color: var(--text-subtle); cursor: pointer;
  transition: var(--transition-colors), background-color var(--dur-fast) var(--ease-standard);
}
.hv-upload__remove:hover { color: var(--danger-fg); background: var(--danger-bg); }
.hv-upload__remove:active { background: var(--danger-hover); transition-duration: 0s; }
.hv-upload__remove svg { width: 16px; height: 16px; display: block; }

@media (prefers-reduced-motion: reduce) {
  .hv-upload__zone--drag .hv-upload__icon { transform: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-upload-css")) {
  const el = document.createElement("style");
  el.id = "hv-upload-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
let _uid = 0;
const nextId = () => `hv-up-${++_uid}`;
const nextKey = () => `f${++_uid}`;
function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const u = ["KB", "MB", "GB"];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  const v = n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1).replace(".", ",");
  return `${v} ${u[i]}`;
}
const ICON = {
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};
const Glyph = ({ name }) => /* @__PURE__ */ React.createElement("span", { dangerouslySetInnerHTML: { __html: ICON[name] } });
const STATUS_LABEL = { uploading: "Enviando\u2026", done: "Conclu\xEDdo", error: "Falhou", ready: "" };
function FileUpload({
  label,
  hint,
  error,
  required = false,
  accept,
  multiple = false,
  disabled = false,
  maxSize,
  compact = false,
  preview = true,
  prompt,
  accentLabel = "selecione",
  defaultFiles = [],
  onFilesChange,
  onSelect,
  id,
  className = ""
}) {
  const fieldId = id || React.useMemo(nextId, []);
  const inputRef = React.useRef(null);
  const createdUrls = React.useRef([]);
  const [dragging, setDragging] = React.useState(false);
  const [files, setFiles] = React.useState(
    () => defaultFiles.map((f) => ({ key: nextKey(), status: "ready", progress: 100, ...f, previewUrl: f.previewUrl || f.url }))
  );
  React.useEffect(() => () => {
    createdUrls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const update = (next) => {
    setFiles(next);
    onFilesChange && onFilesChange(next);
  };
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    onSelect && onSelect(incoming);
    const mapped = incoming.map((file) => {
      const tooBig = maxSize != null && file.size > maxSize;
      const isImage = preview && !tooBig && file.type && file.type.indexOf("image/") === 0;
      let previewUrl;
      if (isImage && typeof URL !== "undefined" && URL.createObjectURL) {
        previewUrl = URL.createObjectURL(file);
        createdUrls.current.push(previewUrl);
      }
      return {
        key: nextKey(),
        name: file.name,
        size: file.size,
        file,
        previewUrl,
        status: tooBig ? "error" : "ready",
        progress: tooBig ? 0 : 100,
        error: tooBig ? `Excede o limite de ${formatBytes(maxSize)}` : void 0
      };
    });
    update(multiple ? [...files, ...mapped] : mapped.slice(-1));
  };
  const remove = (key) => {
    const f = files.find((x) => x.key === key);
    if (f && f.file && f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    update(files.filter((x) => x.key !== key));
  };
  const open = () => {
    if (!disabled) inputRef.current && inputRef.current.click();
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) addFiles(e.dataTransfer.files);
  };
  const onKey = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const zoneCls = [
    "hv-upload__zone",
    compact ? "hv-upload__zone--compact" : "",
    dragging ? "hv-upload__zone--drag" : "",
    error ? "hv-upload__zone--invalid" : "",
    disabled ? "hv-upload__zone--disabled" : ""
  ].filter(Boolean).join(" ");
  const acceptHint = accept ? accept.replace(/\./g, "").toUpperCase().replace(/,/g, " \xB7 ") : null;
  const promptNode = prompt || /* @__PURE__ */ React.createElement(React.Fragment, null, "Arraste ", multiple ? "arquivos" : "um arquivo", " aqui ou ", /* @__PURE__ */ React.createElement("b", null, accentLabel));
  const zone = /* @__PURE__ */ React.createElement("div", { className: "hv-upload" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: zoneCls,
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-disabled": disabled,
      "aria-invalid": !!error,
      "aria-required": required || void 0,
      onClick: open,
      onKeyDown: onKey,
      onDragOver: (e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop
    },
    /* @__PURE__ */ React.createElement("span", { className: "hv-upload__icon" }, /* @__PURE__ */ React.createElement(Glyph, { name: "upload" })),
    compact ? /* @__PURE__ */ React.createElement("span", { className: "hv-upload__copy" }, /* @__PURE__ */ React.createElement("span", { className: "hv-upload__prompt" }, promptNode), acceptHint && /* @__PURE__ */ React.createElement("span", { className: "hv-upload__sub" }, acceptHint)) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "hv-upload__prompt" }, promptNode), acceptHint && /* @__PURE__ */ React.createElement("span", { className: "hv-upload__sub" }, acceptHint, maxSize ? ` \xB7 at\xE9 ${formatBytes(maxSize)}` : "")),
    /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: inputRef,
        id: fieldId,
        type: "file",
        hidden: true,
        accept,
        multiple,
        disabled,
        onChange: (e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }
      }
    )
  ), files.length > 0 && /* @__PURE__ */ React.createElement("ul", { className: "hv-upload__list" }, files.map((f) => {
    const itemCls = [
      "hv-upload__file",
      f.status === "done" ? "hv-upload__file--done" : "",
      f.status === "error" ? "hv-upload__file--error" : ""
    ].filter(Boolean).join(" ");
    const thumbIcon = f.status === "error" ? "alert" : f.status === "done" ? "check" : "file";
    const statusText = f.error || STATUS_LABEL[f.status] || "";
    return /* @__PURE__ */ React.createElement("li", { key: f.key, className: itemCls }, /* @__PURE__ */ React.createElement("span", { className: "hv-upload__file-thumb" }, f.status !== "error" && f.previewUrl ? /* @__PURE__ */ React.createElement("img", { src: f.previewUrl, alt: f.name }) : /* @__PURE__ */ React.createElement(Glyph, { name: thumbIcon })), /* @__PURE__ */ React.createElement("span", { className: "hv-upload__file-meta" }, /* @__PURE__ */ React.createElement("span", { className: "hv-upload__file-name", title: f.name }, f.name), f.status === "uploading" ? /* @__PURE__ */ React.createElement("span", { className: "hv-upload__bar" }, /* @__PURE__ */ React.createElement("span", { className: "hv-upload__bar-fill", style: { width: `${f.progress ?? 0}%` } })) : /* @__PURE__ */ React.createElement("span", { className: "hv-upload__file-info" }, f.size != null && /* @__PURE__ */ React.createElement("span", { className: "hv-upload__file-size" }, formatBytes(f.size)), statusText && /* @__PURE__ */ React.createElement("span", { className: "hv-upload__file-status" }, statusText))), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-upload__remove",
        "aria-label": `Remover ${f.name}`,
        onClick: () => remove(f.key)
      },
      /* @__PURE__ */ React.createElement(Glyph, { name: "x" })
    ));
  })));
  if (!label && !hint && !error) return zone;
  return /* @__PURE__ */ React.createElement("div", { className: "hv-field" }, label && /* @__PURE__ */ React.createElement("label", { className: "hv-field__label", htmlFor: fieldId }, label, required && /* @__PURE__ */ React.createElement("span", { className: "hv-field__req", "aria-hidden": "true" }, "*")), zone, error ? /* @__PURE__ */ React.createElement("span", { className: "hv-field__error" }, error) : hint && /* @__PURE__ */ React.createElement("span", { className: "hv-field__hint" }, hint));
}
export {
  FileUpload
};
