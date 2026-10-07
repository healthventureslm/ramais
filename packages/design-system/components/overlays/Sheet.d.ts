import * as React from "react";

/**
 * Painel que sobe de baixo — a peça central da camada mobile. Dialog, Menu,
 * Select e os date pickers todos viram isto no celular.
 *
 * @startingPoint section="Overlays" subtitle="Sheet com detents" viewport="390x680"
 */
export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Alturas de parada, em FRAÇÃO da altura da tela — o conteúdo é o mesmo num
   * aparelho de 5" e num de 6,7", então px não serve. Em ordem crescente:
   * `[0.4, 0.9]` para em 40% e sobe para 90%.
   *
   * Abre no MAIOR detent. Arrastar a alça para baixo desce um degrau e, no mais
   * baixo, dispensa; arrastar para cima sobe. Abrir no menor inverteria a
   * expectativa — o sheet aparece para mostrar conteúdo, e encolher é a ação
   * deliberada de quem quer ver a tela de trás.
   * @default [0.9]
   */
  detents?: number[];
  /** Índice do detent ativo. Presente, o componente é controlado. */
  detent?: number;
  onDetentChange?: (indice: number) => void;
  /** Alça de arraste no topo. @default true */
  grabber?: boolean;
  /** Permite fechar por scrim, Esc e arraste. @default true */
  dismissible?: boolean;
  /**
   * Centraliza como modal em vez de subir de baixo — o mesmo componente serve
   * ao desktop sem precisar de um segundo. Desliga o arraste e os detents.
   * @default false
   */
  center?: boolean;
  /**
   * Destino do portal. Por padrão `document.body`, que é o correto num app.
   * Aponte para um elemento (ou ref) quando precisar CONTER o sheet dentro de
   * uma moldura — preview, embed, storybook.
   *
   * O elemento precisa virar bloco contentor de descendentes `fixed`, e
   * `position: relative` NÃO faz isso: só `transform`, `filter`, `perspective`,
   * `will-change: transform` ou `contain: layout|paint`. Sem um desses, o
   * painel continua se ancorando na janela mesmo estando dentro do elemento.
   */
  container?: HTMLElement | React.RefObject<HTMLElement> | null;
  /** Rodapé ancorado; recebe a safe area automaticamente. */
  footer?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Sheet(props: SheetProps): React.JSX.Element | null;
