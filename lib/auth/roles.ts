/**
 * One company (RenoDesign, 0015):
 * owner   = Tugu: everything, plus Settings and the Team page (invites).
 * team    = everyone else (Crystal, Ahn, …): every deal, estimate, visit, job and KPI.
 * partner = legacy contractor login (0006/0013); 0015 turned existing ones into team.
 * crew    = worker (installer, plumber, electrician…; v3 F1): only their jobs, never money (0022 views).
 * customer = the client: only their own job, progress and schedule (0022).
 */
export const ROLES = ["owner", "partner", "team", "crew", "customer"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  partner: "Partner",
  team: "Team",
  crew: "Worker",
  customer: "Customer",
};

/** Where each role lands after sign-in. */
export function homeFor(role: Role): string {
  return role === "crew" ? "/work" : role === "customer" ? "/my-job" : "/today";
}
