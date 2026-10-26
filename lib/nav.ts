export type NavIcon = "today" | "deals" | "money" | "more" | "jobs" | "kpis";

export type NavItem = { href: string; label: string; icon: NavIcon };

/** Phone bottom bar and desktop sidebar for me: Today · Deals · Money · More. */
export const TAB_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/deals", label: "Deals", icon: "deals" },
  { href: "/money", label: "Money", icon: "money" },
  { href: "/more", label: "More", icon: "more" },
];

/** Crystal (partner, 0013): no Money; Jobs and KPIs instead. */
export const PARTNER_TAB_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/deals", label: "Deals", icon: "deals" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/kpis", label: "KPIs", icon: "kpis" },
  { href: "/more", label: "More", icon: "more" },
];

export const tabsFor = (role: string) => (role === "partner" ? PARTNER_TAB_ITEMS : TAB_ITEMS);
