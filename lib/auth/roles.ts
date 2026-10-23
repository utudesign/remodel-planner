export const ROLES = ["admin", "designer", "field"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Clerk org role → app role, used only when a membership is first created. */
export function roleFromClerk(clerkRole: string | null | undefined): Role {
  return clerkRole === "org:admin" ? "admin" : "field";
}
