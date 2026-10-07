import * as React from "react";

/**
 * Notificacao de rodape — o que o `Toast` de canto superior vira no celular.
 * No topo ele fica fora do alcance do polegar, e a acao ("Desfazer") e
 * justamente o que a pessoa precisa tocar rapido.
 *
 * @startingPoint section="Feedback" subtitle="Notificacao de rodape" viewport="390x160"
 */
export interface SnackbarProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onClose?: () => void;
  message?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** @default "neutral" */
  tone?: "neutral" | "positive" | "warning" | "danger" | "live";
  /** Rotulo da acao. Aceita string direta em `action` por conveniencia. */
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Milissegundos ate fechar sozinho. **Passe 0 quando houver acao**: sumir
   * enquanto a pessoa decide se vai tocar "Desfazer" e o mesmo que nao ter
   * oferecido a acao. @default 5000
   */
  duration?: number;
  /**
   * `above-tabbar` soma `--tabbar-height`; num produto sem tab bar o token nao
   * existe e ele se comporta como `bottom`. Nada aqui presume a barra.
   * @default "bottom"
   */
  anchor?: "bottom" | "above-tabbar" | "top";
  /** Permite dispensar por arraste. @default true */
  dismissible?: boolean;
  container?: HTMLElement | React.RefObject<HTMLElement> | null;
  className?: string;
}

export function Snackbar(props: SnackbarProps): React.JSX.Element | null;
