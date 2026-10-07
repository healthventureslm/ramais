import React from "react";
import { ListGroup, ListItem } from "./ListItem.js";
import { useViewport } from "../hooks/viewport.js";
import "../_scroll.js";
const CSS = `
.hv-table-wrap { border: var(--border-hair) solid var(--border-subtle); border-radius: var(--radius-lg);
  overflow: hidden; box-shadow: var(--shadow-sm); background: var(--surface-card); font-family: var(--font-sans); }
.hv-table-scroll { overflow-x: auto; }
.hv-table { width: 100%; border-collapse: collapse; }
.hv-table thead th {
  background: var(--surface-sunken); text-align: left; padding: 10px var(--space-4); white-space: nowrap;
  font: 600 var(--text-2xs)/1 var(--font-sans); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--text-body); /* era --text-subtle: 2.49:1 sobre o fundo afundado */
  border-bottom: var(--border-hair) solid var(--border-default); user-select: none;
}
/* Ordenar era um onClick no proprio <th>: sem tabIndex, sem papel e sem
   teclado, entao ordenar a tabela era impossivel sem mouse. O gatilho passa
   a ser um <button> DENTRO do th \u2014 que e o padrao WAI-ARIA para cabecalho
   ordenavel e traz foco, Enter e Espaco de graca \u2014 e o <th> carrega o
   aria-sort, que e quem anuncia a direcao. */
.hv-table th.hv-th--sortable { padding: 0; }
.hv-th__inner { display: inline-flex; align-items: center; gap: 5px; }
button.hv-th__inner {
  width: 100%; box-sizing: border-box; padding: 10px var(--space-4); border: none;
  background: transparent; cursor: pointer; text-align: inherit; color: inherit;
  font: inherit; letter-spacing: inherit; text-transform: inherit;
  transition: var(--transition-colors);
}
button.hv-th__inner:hover { color: var(--text-strong); background: var(--state-press); }
button.hv-th__inner:active { background: var(--state-press-deep); transition-duration: 0s; }
button.hv-th__inner:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-th--num button.hv-th__inner { justify-content: flex-end; }
.hv-th__arrow { display: inline-flex; opacity: 0; color: var(--petrol-600); transition: opacity var(--dur-fast), transform var(--dur-fast); }
button.hv-th__inner:hover .hv-th__arrow { opacity: .4; }
.hv-table th[data-sort="asc"] .hv-th__arrow,
.hv-table th[data-sort="desc"] .hv-th__arrow { opacity: 1; }
.hv-table th[data-sort="desc"] .hv-th__arrow { transform: rotate(180deg); }
.hv-th__arrow svg { width: 13px; height: 13px; }
.hv-th--num, .hv-td--num { text-align: right; font-variant-numeric: tabular-nums; }

.hv-table tbody td { padding: var(--space-3) var(--space-4); font: var(--text-md)/1.4 var(--font-sans); color: var(--text-body);
  border-bottom: var(--border-hair) solid var(--border-subtle); vertical-align: middle; }
.hv-table tbody tr:last-child td { border-bottom: none; }
.hv-table tbody tr { transition: background-color var(--dur-fast) var(--ease-standard); }
.hv-table tbody tr:hover { background: var(--sand-50); }
/* A linha clicavel nao recebia foco nem respondia a Enter. Mantemos o papel
   de LINHA (trocar para role=button quebraria a leitura da tabela) e damos
   o que faltava: ordem de tabulacao, teclado e um anel visivel. */
.hv-table tbody tr.hv-tr--clickable { cursor: pointer; }
.hv-table tbody tr.hv-tr--clickable:focus-visible {
  outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: -2px;
}
.hv-td--mono { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-strong); }
.hv-table__empty { padding: var(--space-9); text-align: center; color: var(--text-muted); font: var(--type-body); }

/* Pagination */
.hv-pagination { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  padding: 11px var(--space-4); border-top: var(--border-hair) solid var(--border-subtle); background: var(--surface-card);
  font-family: var(--font-sans); flex-wrap: wrap; }
.hv-pagination__info { font: var(--text-sm) var(--font-sans); color: var(--text-muted); }
.hv-pagination__info b { color: var(--text-strong); font-weight: 600; }
.hv-pagination__pages { display: flex; align-items: center; gap: 3px; }
.hv-page-btn { min-width: 32px; height: 32px; padding: 0 var(--space-2); border: var(--border-hair) solid transparent;
  background: transparent; cursor: pointer; border-radius: var(--radius-sm); font: 500 var(--text-sm) var(--font-sans);
  color: var(--text-body); display: inline-flex; align-items: center; justify-content: center; transition: var(--transition-colors); }
.hv-page-btn:hover:not(:disabled) { background: var(--state-hover); color: var(--text-strong); }
.hv-page-btn:active:not(:disabled) { background: var(--state-press); transition-duration: 0s; }
.hv-page-btn--active { background: var(--action-primary); color: var(--action-primary-text); font-weight: 600; }
.hv-page-btn--active:hover { background: var(--action-primary-hover); color: var(--action-primary-text); }
.hv-page-btn--active:active { background: var(--action-primary-press); color: var(--action-primary-text); }
.hv-page-btn:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.hv-page-btn:disabled { color: var(--state-disabled-fg); cursor: not-allowed; }
/* 32px e alvo de mouse. No dedo, --tap-min, como o resto do sistema. */
@media (pointer: coarse) {
  .hv-page-btn { min-width: var(--tap-min); height: var(--tap-min); }
}
.hv-page-btn svg { width: 16px; height: 16px; }

@media (prefers-reduced-motion: reduce) {
  .hv-th__arrow { transition: none; }
}
.hv-page-ellipsis { min-width: 24px; text-align: center; color: var(--text-subtle); }

/* --- lista de cards (mobile) --- */
.hv-table-wrap--cards { border: none; background: transparent; }
.hv-table__empty-card {
  padding: var(--space-6); text-align: center;
  font-size: var(--text-sm); color: var(--text-muted);
}
.hv-table__pairs {
  display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4);
  margin-top: var(--space-2);
}
.hv-table__pair { display: inline-flex; align-items: baseline; gap: var(--space-1); min-width: 0; }
.hv-table__pair-k {
  font: var(--weight-semibold) var(--text-2xs)/1.2 var(--font-sans);
  letter-spacing: var(--tracking-wider); text-transform: uppercase; color: var(--text-subtle);
}
.hv-table__pair-v { font: var(--text-sm)/1.3 var(--font-mono); color: var(--text-body); }
.hv-table__foot-cards { padding: var(--space-3) var(--space-1) 0; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-table-css")) {
  const el = document.createElement("style");
  el.id = "hv-table-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Table({
  columns = [],
  data = [],
  rowKey = "id",
  onRowClick,
  sortable = false,
  emptyText = "Nenhum registro.",
  footer,
  responsive = true,
  className = ""
}) {
  const { isMobile } = useViewport();
  const [sort, setSort] = React.useState({ key: null, dir: "asc" });
  const sorted = React.useMemo(() => {
    if (!sort.key) return data;
    const col = columns.find((c) => c.key === sort.key);
    const acc = col && col.sortAccessor || ((row) => row[sort.key]);
    return [...data].sort((a, b) => {
      const av = acc(a), bv = acc(b);
      if (av === bv) return 0;
      const r = av > bv ? 1 : -1;
      return sort.dir === "asc" ? r : -r;
    });
  }, [data, sort, columns]);
  const onSort = (col) => {
    if (!sortable || col.sortable === false) return;
    setSort((s) => s.key === col.key ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" });
  };
  if (responsive && isMobile) {
    const visiveis = columns.filter((c) => !c.hideOnMobile);
    const principal = visiveis.find((c) => c.primary) || visiveis[0];
    const secundaria = visiveis.find((c) => c.secondary) || visiveis.filter((c) => c !== principal)[0];
    const resto = visiveis.filter((c) => c !== principal && c !== secundaria);
    const ler = (col, row) => col.render ? col.render(row) : row[col.key];
    return /* @__PURE__ */ React.createElement("div", { className: ["hv-table-wrap", "hv-table-wrap--cards", className].filter(Boolean).join(" ") }, sorted.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "hv-table__empty-card" }, emptyText), /* @__PURE__ */ React.createElement(ListGroup, null, sorted.map((row, i) => /* @__PURE__ */ React.createElement(
      ListItem,
      {
        key: row[rowKey] != null ? row[rowKey] : i,
        wrap: true,
        title: principal ? ler(principal, row) : null,
        subtitle: secundaria ? ler(secundaria, row) : null,
        onClick: onRowClick ? () => onRowClick(row) : void 0
      },
      resto.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "hv-table__pairs" }, resto.map((c) => /* @__PURE__ */ React.createElement("span", { className: "hv-table__pair", key: c.key }, /* @__PURE__ */ React.createElement("span", { className: "hv-table__pair-k" }, c.header), /* @__PURE__ */ React.createElement("span", { className: "hv-table__pair-v" }, ler(c, row)))))
    ))), footer && /* @__PURE__ */ React.createElement("div", { className: "hv-table__foot-cards" }, footer));
  }
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-table-wrap", className].filter(Boolean).join(" ") }, /* @__PURE__ */ React.createElement("div", { className: "hv-table-scroll hv-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "hv-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, columns.map((c) => {
    const canSort = sortable && c.sortable !== false;
    return /* @__PURE__ */ React.createElement(
      "th",
      {
        key: c.key,
        style: { width: c.width },
        "data-sort": sort.key === c.key ? sort.dir : void 0,
        "aria-sort": canSort ? sort.key === c.key ? sort.dir === "asc" ? "ascending" : "descending" : "none" : void 0,
        className: [c.align === "right" ? "hv-th--num" : "", canSort ? "hv-th--sortable" : ""].filter(Boolean).join(" ")
      },
      canSort ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-th__inner", onClick: () => onSort(c) }, c.header, /* @__PURE__ */ React.createElement("span", { className: "hv-th__arrow", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m18 15-6-6-6 6" })))) : /* @__PURE__ */ React.createElement("span", { className: "hv-th__inner" }, c.header)
    );
  }))), /* @__PURE__ */ React.createElement("tbody", null, sorted.length === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { className: "hv-table__empty", colSpan: columns.length }, emptyText)), sorted.map((row, ri) => /* @__PURE__ */ React.createElement(
    "tr",
    {
      key: row[rowKey] ?? ri,
      className: onRowClick ? "hv-tr--clickable" : "",
      onClick: onRowClick ? () => onRowClick(row) : void 0,
      tabIndex: onRowClick ? 0 : void 0,
      onKeyDown: onRowClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(row);
        }
      } : void 0
    },
    columns.map((c) => /* @__PURE__ */ React.createElement("td", { key: c.key, className: [c.align === "right" ? "hv-td--num" : "", c.mono ? "hv-td--mono" : ""].filter(Boolean).join(" ") }, c.render ? c.render(row) : row[c.key]))
  ))))), footer);
}
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "\u2026", total];
  if (current >= total - 3) return [1, "\u2026", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "\u2026", current - 1, current, current + 1, "\u2026", total];
}
function Pagination({
  page = 1,
  pageCount = 1,
  total,
  pageSize,
  onPageChange,
  itemLabel = "registros",
  ofLabel = "de",
  pageLabel = "P\xE1gina",
  className = ""
}) {
  const go = (p) => {
    if (p >= 1 && p <= pageCount && p !== page) onPageChange && onPageChange(p);
  };
  const from = total != null && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total != null && pageSize ? Math.min(page * pageSize, total) : null;
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-pagination", className].filter(Boolean).join(" ") }, total != null ? /* @__PURE__ */ React.createElement("span", { className: "hv-pagination__info" }, /* @__PURE__ */ React.createElement("b", null, from, "\u2013", to), " ", ofLabel, " ", /* @__PURE__ */ React.createElement("b", null, total), " ", itemLabel) : /* @__PURE__ */ React.createElement("span", { className: "hv-pagination__info" }, pageLabel, " ", /* @__PURE__ */ React.createElement("b", null, page), " ", ofLabel, " ", /* @__PURE__ */ React.createElement("b", null, pageCount)), /* @__PURE__ */ React.createElement("div", { className: "hv-pagination__pages" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-page-btn", disabled: page <= 1, "aria-label": "Anterior", onClick: () => go(page - 1) }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m15 18-6-6 6-6" }))), pageList(page, pageCount).map(
    (p, i) => p === "\u2026" ? /* @__PURE__ */ React.createElement("span", { key: `e${i}`, className: "hv-page-ellipsis" }, "\u2026") : /* @__PURE__ */ React.createElement("button", { key: p, type: "button", className: ["hv-page-btn", p === page ? "hv-page-btn--active" : ""].filter(Boolean).join(" "), onClick: () => go(p) }, p)
  ), /* @__PURE__ */ React.createElement("button", { type: "button", className: "hv-page-btn", disabled: page >= pageCount, "aria-label": "Pr\xF3xima", onClick: () => go(page + 1) }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m9 18 6-6-6-6" })))));
}
export {
  Pagination,
  Table
};
