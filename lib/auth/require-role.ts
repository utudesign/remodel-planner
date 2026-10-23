import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { createServerSupabase, type Db } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isRole, roleFromClerk, type Role } from "@/lib/auth/roles";
import { companyRules, type CompanyRules } from "@/lib/routing";

export type Session = {
  db: Db;
  clerkUserId: string;
  userId: string; // public.users.id
  companyId: string;
  companyName: string;
  timezone: string;
  role: Role;
  name: string;
  settings: { targetMarginBps: number; designDueDays: number; raw: Record<string, unknown> };
  rules: CompanyRules;
};

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Creates the company + member rows the first time someone signs in, so local dev works
 * without a webhook tunnel. The webhook does the same thing in production.
 */
async function bootstrap(clerkUserId: string, orgId: string, orgRole: string | null | undefined) {
  const [user, org] = await Promise.all([
    currentUser(),
    (await clerkClient()).organizations.getOrganization({ organizationId: orgId }),
  ]);
  const { error } = await createAdminSupabase().rpc("bootstrap_membership", {
    p_clerk_org_id: orgId,
    p_org_name: org.name,
    p_clerk_user_id: clerkUserId,
    p_name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
    p_email: user?.primaryEmailAddress?.emailAddress ?? "",
    p_role: roleFromClerk(orgRole),
  });
  if (error) throw new Error(`Could not set up your account: ${error.message}`);
}

async function loadMember(db: Db, clerkUserId: string) {
  const { data, error } = await db
    .from("users")
    .select("id, role, name, active, company:companies(id, name, timezone, settings_json)")
    .eq("clerk_id", clerkUserId)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    throw new Error(
      `The database rejected your sign-in (${error.message}). Check Supabase → Authentication → Third-party auth → Clerk, and Clerk → Integrations → Supabase (docs/DEPLOY.md).`,
    );
  }
  return data;
}

/** Signed-in member of the active Clerk org. Redirects to sign-in / org picker otherwise. */
export const getSession = cache(async (): Promise<Session> => {
  const { userId: clerkUserId, orgId, orgRole } = await auth();
  if (!clerkUserId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const db = createServerSupabase();
  let member = await loadMember(db, clerkUserId);
  if (!member) {
    await bootstrap(clerkUserId, orgId, orgRole);
    member = await loadMember(db, clerkUserId);
  }
  if (!member || !member.company || !isRole(member.role)) {
    throw new Error(
      "Your account isn't linked to this company yet. Check that Supabase third-party auth for Clerk is configured (docs/DEPLOY.md).",
    );
  }
  const settings = (member.company.settings_json ?? {}) as Record<string, unknown>;
  return {
    db,
    clerkUserId,
    userId: member.id,
    companyId: member.company.id,
    companyName: member.company.name,
    timezone: member.company.timezone,
    role: member.role,
    name: member.name,
    settings: {
      targetMarginBps: typeof settings.target_margin_bps === "number" ? settings.target_margin_bps : 3500,
      designDueDays: typeof settings.design_due_days === "number" ? settings.design_due_days : 5,
      raw: settings,
    },
    rules: companyRules(settings),
  };
});

/** For server actions / route handlers: throws ForbiddenError when the role isn't allowed. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (roles.length && !roles.includes(session.role)) throw new ForbiddenError();
  return session;
}

/** For pages: sends users without access back to Today instead of erroring. */
export async function requirePageRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (roles.length && !roles.includes(session.role)) redirect("/today");
  return session;
}
