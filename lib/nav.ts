import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: "today" | "leads" | "projects" | "payments" | "analytics" | "settings";
  roles: Role[];
};

/** Calendar is on the sitemap but is Phase 2; intentionally absent (docs/DECISIONS.md). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: "today", roles: ["owner", "team", "crew"] },
  { href: "/leads", label: "Leads", icon: "leads", roles: ["owner", "team"] },
  { href: "/projects", label: "Projects", icon: "projects", roles: ["owner", "team", "crew"] },
  { href: "/payments", label: "Payments", icon: "payments", roles: ["owner", "team"] },
  { href: "/analytics", label: "Analytics", icon: "analytics", roles: ["owner", "team"] },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["owner"] },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
