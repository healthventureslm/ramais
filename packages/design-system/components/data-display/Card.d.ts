import * as React from "react";

/** Surface container. Compose with CardHeader / CardBody / CardFooter. */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover lift + pointer cursor. @default false */
  interactive?: boolean;
  /** Remove the shadow. @default false */
  flat?: boolean;
  /** Tinted brand surface (--surface-brand-soft). @default false */
  accent?: boolean;
  /** Apply default card padding directly (when not using sub-parts). @default false */
  padded?: boolean;
  children?: React.ReactNode;
}
export function Card(props: CardProps): React.JSX.Element;

export interface CardHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned action slot (e.g. an IconButton). */
  action?: React.ReactNode;
  children?: React.ReactNode;
}
export function CardHeader(props: CardHeaderProps): React.JSX.Element;

export function CardBody(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element;
export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element;
