import * as React from "react";

/** `positive` e o nome canonico (o mesmo do par semantico). `success` e
 *  `critical` sao apelidos aceitos de `positive` e `danger`. */
export type BannerVariant = "info" | "positive" | "warning" | "danger" | "success" | "critical";

export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Semantic variant — sets the color pair, default icon and ARIA role. @default "info" */
  /** `critical` e alias de `danger` — Lucide e a maioria das libs chamam o
   *  nivel mais grave assim, e aceitar o alias evita um adapter no consumidor. */
  variant?: BannerVariant;
  /** Bold heading line. */
  title?: React.ReactNode;
  /** Secondary explanatory text. */
  description?: React.ReactNode;
  /** Override the default icon. Pass `null` to hide it entirely. */
  /**
   * Icone. Aceita elemento (`icon={<Lock/>}`) OU componente
   * (`icon={Lock}`, do jeito que o Lucide entrega). `null` remove o icone;
   * ausente usa o padrao da variante.
   */
  icon?: React.ReactNode | React.ComponentType<any>;
  /** Inline meta slot on the right (e.g. a `<Badge>` like "137h"), before any actions. */
  meta?: React.ReactNode;
  /** Action buttons rendered on the right (e.g. one or more `Button`s). */
  actions?: React.ReactNode;
  /** When provided, shows a close button that calls this handler. */
  onClose?: () => void;
  /** ARIA role. Defaults to `alert` for warning/danger, `status` otherwise. */
  role?: string;
  /** Extra nested content (lists, items) below the description. */
  children?: React.ReactNode;
}

export function Banner(props: BannerProps): React.JSX.Element;
