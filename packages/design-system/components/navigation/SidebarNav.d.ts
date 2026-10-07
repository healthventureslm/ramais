import * as React from "react";

/**
 * Primary product navigation rail. Two surfaces (`brand` petrol or `light` clean),
 * a monogram + rich brand lockup, sections, collapsible groups, an active item as a
 * coral accent or soft pill, an integrated ChatGPT-style collapse (icon rail with
 * tooltips + monogram expand handle), an optional mobile off-canvas drawer, and a
 * rich user footer. Fully backward compatible.
 *
 * @startingPoint section="Navigation" subtitle="Health Ventures product sidebar" viewport="280x720"
 */
export interface SidebarNavProps {
  brand?: SidebarBrand;
  /**
   * Custom brand lockup node, replacing the default title/subtitle wordmark
   * (the monogram stays). Alias for `brand.render`; this top-level prop wins.
   */
  brandSlot?: React.ReactNode;
  items: SidebarItem[];
  /** Currently active item id. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Footer user block. */
  user?: SidebarUser;
  /** Footer action buttons (profile, notifications, logout…). Stacked as icons when collapsed. */
  userActions?: SidebarUserAction[];
  /** Makes the user block (avatar + name/role) clickable — e.g. to open the profile. */
  onUserClick?: () => void;
  /**
   * Surface theme. `brand` (default) = petrol-green dark rail; `light` = clean
   * white/neutral surface with a right border. Uses semantic tokens (theme-safe).
   * @default "brand"
   */
  surface?: "brand" | "light";
  /**
   * Active item treatment. `accent` (default) = filled highlight + coral side bar;
   * `pill` = soft filled pill (petrol-50 / translucent petrol), no side bar.
   * @default "accent"
   */
  activeStyle?: "accent" | "pill";
  /**
   * Collapse to an icon-only rail. When provided, the sidebar is **controlled**
   * (pair with `onCollapsedChange` or your own state). Omit it and set `collapsible`
   * to let the component manage + persist collapse itself. @default undefined
   */
  collapsed?: boolean;
  /**
   * Render the built-in collapse control (header toggle when expanded; the monogram
   * becomes the expand handle when collapsed). If `collapsed` is omitted, the state
   * is self-managed and persisted at `${persistKey}:collapsed`. @default false
   */
  collapsible?: boolean;
  /** Called with the next collapsed state whenever the built-in control toggles. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Extra node at the far right of the user footer (e.g. a logout IconButton). */
  footerAction?: React.ReactNode;
  /** Render as a fixed off-canvas drawer (mobile). Pair with `mobileOpen`/`onMobileClose`. @default false */
  mobile?: boolean;
  /** Whether the mobile drawer is open. */
  mobileOpen?: boolean;
  /** Called when the backdrop is clicked or an item is selected on mobile. */
  onMobileClose?: () => void;
  /**
   * localStorage key prefix used to persist collapsible group state and, when
   * `collapsible` is self-managed, the collapsed state (`${persistKey}:collapsed`).
   */
  persistKey?: string;
  className?: string;
}

export function SidebarNav(props: SidebarNavProps): React.JSX.Element;

export interface SidebarBrand {
  title: string;
  subtitle?: string;
  /** URL of the monogram image. */
  markSrc?: string | null;
  /** Custom lockup node replacing title/subtitle (monogram stays). See also `brandSlot`. */
  render?: React.ReactNode;
}

export interface SidebarItem {
  /** "section" = static group label; "group" = collapsible group with nested `items`; otherwise a nav link. */
  type?: "section" | "group" | "item";
  id?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  /** Count pill (e.g. pending patients). */
  count?: number;
  /** Small dot indicator (e.g. unread). */
  badge?: boolean;
  /** Nested links for a `type: "group"`. */
  items?: SidebarItem[];
  /** Initial open state for a collapsible group (overridden by persisted state). @default true */
  defaultOpen?: boolean;
}

export interface SidebarUser {
  name: string;
  role?: string;
  initials: string;
  /** Optional avatar image URL (falls back to initials). */
  avatarSrc?: string;
}

export interface SidebarUserAction {
  id?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  /** `true` renders a dot; a number/string renders a counter badge. */
  badge?: boolean | number | string;
}
