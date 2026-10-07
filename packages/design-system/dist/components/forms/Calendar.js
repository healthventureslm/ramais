import React from "react";
const CSS = `
.hv-date__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); gap: var(--space-1); }
.hv-date__title {
  font: 600 var(--text-md)/1 var(--font-display); color: var(--text-strong); text-transform: capitalize;
  border: none; background: transparent; cursor: pointer; padding: 6px 10px; border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; gap: 5px; transition: var(--transition-colors);
}
.hv-date__title:hover { background: var(--state-hover); }
.hv-date__title:active { background: var(--state-press); transition-duration: 0s; }
.hv-date__title:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: 1px; }
/* A seta indica que da para subir de nivel. Sem ela o titulo nao parece
   clicavel, e o atalho que resolve a navegacao longa fica escondido. */
.hv-date__title svg { width: 13px; height: 13px; color: var(--text-muted); transition: transform var(--dur-fast) var(--ease-standard); }
.hv-date__title[data-mode="months"] svg,
.hv-date__title[data-mode="years"] svg { transform: rotate(180deg); }

.hv-date__nav { border: none; background: transparent; cursor: pointer; color: var(--text-muted);
  width: 30px; height: 30px; border-radius: var(--radius-sm); display: inline-flex; align-items: center; justify-content: center;
  transition: var(--transition-colors); flex: none; }
.hv-date__nav:hover { background: var(--state-hover); color: var(--brand-soft-fg); }
.hv-date__nav:active { background: var(--state-press); transition-duration: 0s; }
.hv-date__nav:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: 1px; }
.hv-date__nav svg { width: 17px; height: 17px; }

.hv-date__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.hv-date__dow { font: 600 var(--text-2xs)/1 var(--font-sans); letter-spacing: var(--tracking-wide); text-transform: uppercase;
  color: var(--text-subtle); text-align: center; padding: var(--space-1) 0 var(--space-2); }
.hv-date__cell { aspect-ratio: 1; border: none; background: transparent; cursor: pointer; border-radius: var(--radius-sm);
  font: var(--text-sm) var(--font-sans); color: var(--text-body); display: inline-flex; align-items: center; justify-content: center;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard); position: relative; }
.hv-date__cell:hover:not(:disabled) { background: var(--state-brand-hover); color: var(--brand-soft-fg); }
.hv-date__cell:active:not(:disabled) { background: var(--state-brand-press); transition-duration: 0s; }
.hv-date__cell:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: -1px; }
/* Dia de outro mes. Era --text-subtle E opacity .55 por cima \u2014 apagado duas
   vezes, e o segundo apagamento por transparencia, que entrega a cor final ao
   que estiver atras. Um degrau de tinta so. */
.hv-date__cell--muted { color: var(--text-subtle); }
/* O ponto de HOJE era --coral-500: a tinta do LIVE marcando uma data. Hoje nao
   e processo com relogio correndo. Vai na tinta de marca, a mesma do numero. */
.hv-date__cell--today { font-weight: var(--weight-semibold); color: var(--brand-soft-fg); }
.hv-date__cell--today::after { content: ""; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 50%; background: var(--action-primary); }
.hv-date__cell--selected { background: var(--action-primary); color: var(--action-primary-text); font-weight: 600; }
.hv-date__cell--selected:hover { background: var(--action-primary-hover); color: var(--action-primary-text); }
.hv-date__cell--selected:active { background: var(--action-primary-press); color: var(--action-primary-text); }
.hv-date__cell:disabled { color: var(--state-disabled-fg); cursor: not-allowed; }

/* Meses e anos: 3 colunas, alvos largos. Nao herdam o aspect-ratio quadrado
   dos dias porque o rotulo e uma palavra, nao um numero de dois digitos. */
.hv-date__coarse { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-1); }
.hv-date__coarse-cell {
  border: none; background: transparent; cursor: pointer; border-radius: var(--radius-sm);
  font: var(--text-sm) var(--font-sans); color: var(--text-body); padding: 11px var(--space-1);
  text-transform: capitalize; transition: var(--transition-colors);
}
.hv-date__coarse-cell:hover:not(:disabled) { background: var(--state-brand-hover); color: var(--brand-soft-fg); }
.hv-date__coarse-cell:active:not(:disabled) { background: var(--state-brand-press); transition-duration: 0s; }
.hv-date__coarse-cell:focus-visible { outline: var(--focus-ring-inset-w) solid var(--focus-ring); outline-offset: -1px; }
.hv-date__coarse-cell--current { font-weight: 600; color: var(--petrol-700); }
.hv-date__coarse-cell--selected { background: var(--action-primary); color: var(--action-primary-text); font-weight: 600; }
.hv-date__coarse-cell:disabled { color: var(--state-disabled-fg); cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .hv-date__title svg { transition: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-date-calendar-css")) {
  const el = document.createElement("style");
  el.id = "hv-date-calendar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ChevL = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m15 18-6-6 6-6" }));
const ChevR = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m9 18 6-6-6-6" }));
const ChevD = /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" }));
const mesmoDia = (a, b) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const mesmoDiaOutroMes = (ano, mes, dia) => new Date(ano, mes, Math.min(dia, new Date(ano, mes + 1, 0).getDate()));
const BLOCO = 12;
function Calendar({
  month,
  onMonthChange,
  getCellProps,
  min,
  max,
  monthNames = ["janeiro", "fevereiro", "mar\xE7o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "s\xE1b"],
  prevLabel = "Anterior",
  nextLabel = "Pr\xF3ximo",
  zoomLabel = "Trocar m\xEAs ou ano",
  className = "",
  ...rest
}) {
  const view = month instanceof Date ? month : /* @__PURE__ */ new Date();
  const y = view.getFullYear(), m = view.getMonth();
  const [modo, setModo] = React.useState("days");
  const [foco, setFoco] = React.useState(null);
  const gradeRef = React.useRef(null);
  const querFoco = React.useRef(false);
  React.useEffect(() => {
    if (!querFoco.current || !gradeRef.current) return;
    querFoco.current = false;
    const alvo = gradeRef.current.querySelector('[data-foco="true"]');
    if (alvo) alvo.focus();
  });
  const soData = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dentro = (d) => (!min || soData(d) >= soData(min)) && (!max || soData(d) <= soData(max));
  const irPara = (d) => {
    querFoco.current = true;
    setFoco(d);
    if (d.getFullYear() !== y || d.getMonth() !== m) {
      onMonthChange && onMonthChange(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };
  const onKeyDown = (e) => {
    const base = foco || new Date(y, m, 1);
    const anda = (dias) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
    const mapa = {
      ArrowLeft: () => anda(-1),
      ArrowRight: () => anda(1),
      ArrowUp: () => anda(-7),
      ArrowDown: () => anda(7),
      Home: () => anda(-base.getDay()),
      End: () => anda(6 - base.getDay()),
      PageUp: () => mesmoDiaOutroMes(base.getFullYear() - (e.shiftKey ? 1 : 0), base.getMonth() - (e.shiftKey ? 0 : 1), base.getDate()),
      PageDown: () => mesmoDiaOutroMes(base.getFullYear() + (e.shiftKey ? 1 : 0), base.getMonth() + (e.shiftKey ? 0 : 1), base.getDate())
    };
    const f = mapa[e.key];
    if (!f) return;
    e.preventDefault();
    irPara(f());
  };
  const hoje = /* @__PURE__ */ new Date();
  if (modo === "months") {
    return /* @__PURE__ */ React.createElement("div", { className, ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-date__head" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-date__nav",
        "aria-label": prevLabel,
        onClick: () => onMonthChange && onMonthChange(new Date(y - 1, m, 1))
      },
      ChevL
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-date__title",
        "data-mode": "months",
        "aria-label": zoomLabel,
        onClick: () => setModo("years")
      },
      y,
      ChevD
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-date__nav",
        "aria-label": nextLabel,
        onClick: () => onMonthChange && onMonthChange(new Date(y + 1, m, 1))
      },
      ChevR
    )), /* @__PURE__ */ React.createElement("div", { className: "hv-date__coarse" }, monthNames.map((nome, i) => {
      const vazio = !dentro(new Date(y, i, 1)) && !dentro(new Date(y, i + 1, 0));
      const cls = [
        "hv-date__coarse-cell",
        i === m ? "hv-date__coarse-cell--selected" : "",
        i === hoje.getMonth() && y === hoje.getFullYear() && i !== m ? "hv-date__coarse-cell--current" : ""
      ].filter(Boolean).join(" ");
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: nome,
          type: "button",
          className: cls,
          disabled: vazio,
          onClick: () => {
            onMonthChange && onMonthChange(new Date(y, i, 1));
            setModo("days");
          }
        },
        nome.slice(0, 3)
      );
    })));
  }
  if (modo === "years") {
    const ini = Math.floor(y / BLOCO) * BLOCO;
    return /* @__PURE__ */ React.createElement("div", { className, ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-date__head" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-date__nav",
        "aria-label": prevLabel,
        onClick: () => onMonthChange && onMonthChange(new Date(y - BLOCO, m, 1))
      },
      ChevL
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-date__title",
        "data-mode": "years",
        "aria-label": zoomLabel,
        onClick: () => setModo("days")
      },
      ini,
      "\u2013",
      ini + BLOCO - 1,
      ChevD
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "hv-date__nav",
        "aria-label": nextLabel,
        onClick: () => onMonthChange && onMonthChange(new Date(y + BLOCO, m, 1))
      },
      ChevR
    )), /* @__PURE__ */ React.createElement("div", { className: "hv-date__coarse" }, Array.from({ length: BLOCO }, (_, i) => ini + i).map((ano) => {
      const vazio = !dentro(new Date(ano, 0, 1)) && !dentro(new Date(ano, 11, 31));
      const cls = [
        "hv-date__coarse-cell",
        ano === y ? "hv-date__coarse-cell--selected" : "",
        ano === hoje.getFullYear() && ano !== y ? "hv-date__coarse-cell--current" : ""
      ].filter(Boolean).join(" ");
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: ano,
          type: "button",
          className: cls,
          disabled: vazio,
          onClick: () => {
            onMonthChange && onMonthChange(new Date(ano, m, 1));
            setModo("months");
          }
        },
        ano
      );
    })));
  }
  const startDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push({ d: new Date(y, m, -(startDow - 1 - i)), muted: true });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ d: new Date(y, m, i), muted: false });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].d;
    cells.push({ d: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), muted: true });
  }
  const decorados = cells.map(({ d, muted }) => ({ d, muted, cp: getCellProps && getCellProps(d, muted) || {} }));
  const selecionada = decorados.find((c) => !c.muted && String(c.cp.className || "").indexOf("--selected") >= 0);
  const alvoTab = foco || selecionada && selecionada.d || new Date(y, m, 1);
  return /* @__PURE__ */ React.createElement("div", { className, ...rest }, /* @__PURE__ */ React.createElement("div", { className: "hv-date__head" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-date__nav",
      "aria-label": prevLabel,
      onClick: () => onMonthChange && onMonthChange(new Date(y, m - 1, 1))
    },
    ChevL
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-date__title",
      "data-mode": "days",
      "aria-label": zoomLabel,
      onClick: () => setModo("months")
    },
    monthNames[m],
    " ",
    y,
    ChevD
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-date__nav",
      "aria-label": nextLabel,
      onClick: () => onMonthChange && onMonthChange(new Date(y, m + 1, 1))
    },
    ChevR
  )), /* @__PURE__ */ React.createElement("div", { className: "hv-date__grid", ref: gradeRef, onKeyDown }, dayNames.map((d) => /* @__PURE__ */ React.createElement("span", { key: d, className: "hv-date__dow" }, d)), decorados.map(({ d, muted, cp }, i) => {
    const cls = ["hv-date__cell", muted ? "hv-date__cell--muted" : "", cp.className || ""].filter(Boolean).join(" ");
    const naVez = mesmoDia(d, alvoTab);
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: i,
        type: "button",
        className: cls,
        disabled: cp.disabled,
        tabIndex: naVez ? 0 : -1,
        "data-foco": naVez ? "true" : void 0,
        onClick: cp.onClick,
        onMouseEnter: cp.onMouseEnter,
        onFocus: cp.onMouseEnter
      },
      d.getDate()
    );
  })));
}
export {
  Calendar
};
