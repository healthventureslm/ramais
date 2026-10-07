import * as React from "react";

export interface BreadcrumbItem {
  label: React.ReactNode;
  /** Link target; omit for a non-link crumb. The last item renders as current page. */
  href?: string;
  /** Leading icon node. */
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Navigation trail. Chevron or slash separators, optional home icon, and
 * automatic middle-collapse (…) into a popover menu when the path is long.
 *
 * @startingPoint section="Navigation" subtitle="Page trail with collapse" viewport="700x120"
 */
export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /** Separator style. @default "chevron" */
  separator?: "chevron" | "slash";
  /** Show a leading home icon. @default false */
  home?: boolean;
  /** Collapse the middle into … when there are more than this many items (0 = never). @default 0 */
  maxItems?: number;
}

export function Breadcrumbs(props: BreadcrumbsProps): React.JSX.Element;
