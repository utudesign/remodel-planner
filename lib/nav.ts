import type { Role } from "@/lib/auth/roles";

export type NavIcon = "today" | "command" | "deals" | "payments" | "activity" | "analytics" | "settings" | "more";

export type NavItem = { href: string; label: string; icon: NavIcon; roles: Role[] };

const ALL: Role[] = ["owner", "team", "crew"];
const TEAM: Role[] = ["owner", "team"];

/** Phone bottom bar (CONTEXT §6): Today · Deals · Money · More. Crew: Today · Deals (their assigned ones). */
export const TAB_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today", roles: ALL },
  { href: "/deals", label: "Deals", icon: "deals", roles: ALL },
  { href: "/payments", label: "Money", icon: "payments", roles: TEAM },
  { href: "/more", label: "More", icon: "more", roles: TEAM },
];

/** Sidebar on ≥ 1024 px. Calendar is Phase 5 (not listed). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today", roles: ALL },
  { href: "/command", label: "Command center", icon: "command", roles: TEAM },
  { href: "/deals", label: "Deals", icon: "deals", roles: ALL },
  { href: "/payments", label: "Money", icon: "payments", roles: TEAM },
  { href: "/activity", label: "Activity", icon: "activity", roles: TEAM },
  { href: "/analytics", label: "Analytics", icon: "analytics", roles: TEAM },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["owner"] },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function tabsFor(role: Role): NavItem[] {
  return TAB_ITEMS.filter((i) => i.roles.includes(role));
}
