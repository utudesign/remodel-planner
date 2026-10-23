/**
 * owner   = the rep (Tugu): everything.
 * partner = a contractor's login (Crystal): only deals handed to her company, only job fields (0006).
 * team / crew exist in the SQL for the optional contractor module; no screens use them now.
 */
export const ROLES = ["owner", "partner", "team", "crew"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  partner: "Partner",
  team: "Team",
  crew: "Crew",
};
