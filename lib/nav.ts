export type NavIcon = "today" | "deals" | "money" | "more" | "jobs" | "kpis";

export type NavItem = { href: string; label: string; icon: NavIcon };

/** One company (0015): everyone gets Today · Deals · Jobs · KPIs · More. */
export const TAB_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/deals", label: "Deals", icon: "deals" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/kpis", label: "KPIs", icon: "kpis" },
  { href: "/more", label: "More", icon: "more" },
];

export const tabsFor = (): NavItem[] => TAB_ITEMS;
