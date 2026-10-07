import React from "react";
const CSS = `
.hv-card {
  background: var(--surface-card); border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
  transition: box-shadow var(--dur-normal) var(--ease-standard),
              background-color var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard);
}
.hv-card--pad { padding: var(--pad-card); }
/* interactive dava cursor e hover, mas o elemento continuava um <div>:
   sem ordem de tabulacao, sem teclado e sem anel. Clicavel no mouse,
   inexistente no teclado \u2014 o mesmo defeito do <th> ordenavel do Table.
   Se o cartao ja contem o proprio link, use o link e NAO interactive:
   role=button achata o conteudo para o leitor de tela. */
.hv-card--interactive { cursor: pointer; }
.hv-card--interactive:focus-visible { outline: none; box-shadow: var(--shadow-focus), var(--shadow-md); }
/* Era translateY(-1px) no hover, com o :active apenas DESFAZENDO o lift.

   Duas coisas erradas numa. O lift esta na lista de "nunca" do DESIGN.md e o
   StatCard ja o removeu com a justificativa escrita \u2014 o Card ficou como a
   unica superficie do sistema que ainda levita. E o press nao era um press:
   transform: translateY(0) so devolve o cartao ao lugar de onde o hover
   tirou. Sem mouse nao existe hover, entao no toque o press nao acontecia \u2014
   exatamente o estado que so existe para o dedo.

   Agora o hover e degrau de borda + sombra (mesmo par do StatCard) e o press
   e tinta propria, que funciona com ou sem hover antes. */
.hv-card--interactive:hover { box-shadow: var(--shadow-md); border-color: var(--border-control); }
.hv-card--interactive:active { background: var(--state-hover); box-shadow: var(--shadow-sm); transition-duration: 0s; }
/* O accent press desce na PROPRIA rampa: --state-hover e tinta de areia opaca
   e apagaria a superficie de marca justo no quadro do toque. petrol-50 ->
   petrol-100 e o exemplo que a Regra do press cita por nome. */
.hv-card--accent.hv-card--interactive:active { background: var(--state-brand-press); }
.hv-card--flat { box-shadow: none; }
/* Era border-left: 3px solid var(--petrol-500) \u2014 a aba lateral colorida, o
   tell mais reconhecivel de card gerado, e aqui com dois agravantes: a aresta
   reta cortava os cantos de --radius-lg, e a tinta vinha de um degrau de rampa
   em vez do papel.

   O trabalho que o accent faz e dizer "este cartao pertence ao contexto de
   marca". Superficie diz isso sem barra e respeita a forma inteira. O fio sai
   junto: sobre a tinta ele vira a segunda metafora de separacao no mesmo
   elemento, e a sombra ja da conta. */
.hv-card--accent { background: var(--surface-brand-soft); border-color: transparent; }

.hv-card__header { display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--space-3); padding: var(--space-5) var(--space-5) var(--space-3); }
.hv-card__title { font: var(--weight-semibold) var(--text-lg)/1.25 var(--font-display);
  color: var(--text-strong); letter-spacing: var(--tracking-snug); margin: 0; }
.hv-card__sub { font: var(--text-xs)/1.4 var(--font-sans); color: var(--text-muted); margin: 3px 0 0; }
.hv-card__body { padding: 0 var(--space-5) var(--space-5); }
.hv-card__footer { display: flex; align-items: center; gap: 10px; padding: var(--space-4) var(--space-5);
  border-top: var(--border-hair) solid var(--border-subtle); }

`;
if (typeof document !== "undefined" && !document.getElementById("hv-card-css")) {
  const el = document.createElement("style");
  el.id = "hv-card-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Card({
  interactive = false,
  flat = false,
  accent = false,
  padded = false,
  className = "",
  children,
  ...rest
}) {
  const cls = [
    "hv-card",
    interactive ? "hv-card--interactive" : "",
    flat ? "hv-card--flat" : "",
    accent ? "hv-card--accent" : "",
    padded ? "hv-card--pad" : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: cls,
      tabIndex: interactive ? 0 : void 0,
      role: interactive ? "button" : void 0,
      onKeyDown: interactive ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      } : void 0,
      ...rest
    },
    children
  );
}
function CardHeader({ title, subtitle, action, children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "hv-card__header" }, /* @__PURE__ */ React.createElement("div", null, title && /* @__PURE__ */ React.createElement("h3", { className: "hv-card__title" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "hv-card__sub" }, subtitle), children), action);
}
function CardBody({ className = "", children, ...rest }) {
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-card__body", className].filter(Boolean).join(" "), ...rest }, children);
}
function CardFooter({ className = "", children, ...rest }) {
  return /* @__PURE__ */ React.createElement("div", { className: ["hv-card__footer", className].filter(Boolean).join(" "), ...rest }, children);
}
export {
  Card,
  CardBody,
  CardFooter,
  CardHeader
};
