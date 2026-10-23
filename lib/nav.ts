export type NavIcon = "today" | "deals" | "money" | "more";

export type NavItem = { href: string; label: string; icon: NavIcon };

/** Phone bottom bar and desktop sidebar: Today · Deals · Money · More. */
export const TAB_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/deals", label: "Deals", icon: "deals" },
  { href: "/money", label: "Money", icon: "money" },
  { href: "/more", label: "More", icon: "more" },
];
