export const ROLES = ["owner", "team", "crew"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Clerk org role → app role, used only when a membership is first created. */
export function roleFromClerk(clerkRole: string | null | undefined): Role {
  return clerkRole === "org:admin" ? "owner" : "crew";
}

/**
 * owner = the partners (everything, incl. Settings, users, closing jobs).
 * team  = office admin (sees and edits everything except Settings/users/closing).
 * crew  = installers/subs (only assigned jobs, never money).
 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  team: "Team",
  crew: "Crew",
};
