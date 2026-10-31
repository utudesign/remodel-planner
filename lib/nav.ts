export type NavIcon = "today" | "deals" | "money" | "more" | "jobs" | "kpis" | "work" | "report" | "home" | "bell";
import type { Role } from "@/lib/auth/roles";

export type NavItem = { href: string; label: string; icon: NavIcon };

/** One company (0015): everyone gets Today · Deals · Jobs · KPIs · More. */
export const TAB_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/deals", label: "Deals", icon: "deals" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/kpis", label: "KPIs", icon: "kpis" },
  { href: "/more", label: "More", icon: "more" },
];

/** Workers (v3 F1): their jobs + the daily report. Customers: one page, no tab bar. */
export const CREW_TABS: NavItem[] = [
  { href: "/work", label: "My work", icon: "work" },
  { href: "/work/report", label: "Daily report", icon: "report" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
];

export const tabsFor = (role?: Role): NavItem[] => (role === "crew" ? CREW_TABS : role === "customer" ? [] : TAB_ITEMS);
