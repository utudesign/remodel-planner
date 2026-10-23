import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: "today" | "leads" | "projects" | "payments" | "analytics" | "settings";
  roles: Role[];
};

/** Calendar is on the sitemap but is Phase 2; intentionally absent (docs/DECISIONS.md). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today", roles: ["admin", "designer", "field"] },
  { href: "/leads", label: "Leads", icon: "leads", roles: ["admin", "designer"] },
  { href: "/projects", label: "Projects", icon: "projects", roles: ["admin", "designer", "field"] },
  { href: "/payments", label: "Payments", icon: "payments", roles: ["admin", "designer"] },
  { href: "/analytics", label: "Analytics", icon: "analytics", roles: ["admin", "designer"] },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["admin"] },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
