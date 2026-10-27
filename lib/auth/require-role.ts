import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerSupabase, type Db } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/auth/roles";

export type CompanySettings = {
  mileageRateCents: number;
  taxSetAsidePct: number;
  workday: { days: number[]; start: string; end: string };
  digestTime: string;
  booking: {
    minutes: number;
    weekday: { start: string; end: string };
    saturday: { start: string; end: string };
  };
  autoReply: string | null;
  raw: Record<string, unknown>;
};

export type Session = {
  db: Db;
  clerkUserId: string;
  userId: string; // public.users.id
  companyId: string;
  companyName: string;
  timezone: string;
  role: Role;
  name: string;
  partnerId: string | null;
  settings: CompanySettings;
};

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function num(v: unknown, d: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

export function readSettings(raw: Record<string, unknown>): CompanySettings {
  const workday = (raw.workday ?? {}) as Partial<CompanySettings["workday"]>;
  const booking = (raw.booking ?? {}) as Partial<CompanySettings["booking"]>;
  return {
    mileageRateCents: num(raw.mileage_rate_cents, 72.5),
    taxSetAsidePct: num(raw.tax_set_aside_pct, 30),
    workday: {
      days: Array.isArray(workday.days) ? workday.days : [1, 2, 3, 4, 5],
      start: workday.start ?? "07:00",
      end: workday.end ?? "15:30",
    },
    digestTime: typeof raw.digest_time === "string" ? raw.digest_time : "15:30",
    booking: {
      minutes: num(booking.minutes, 90),
      weekday: booking.weekday ?? { start: "17:30", end: "20:00" },
      saturday: booking.saturday ?? { start: "09:00", end: "17:00" },
    },
    autoReply: typeof raw.auto_reply === "string" ? raw.auto_reply : null,
    raw,
  };
}

async function loadMember(db: Db, clerkUserId: string) {
  const { data, error } = await db
    .from("users")
    .select("id, role, name, active, partner_id, company:companies(id, name, timezone, settings_json)")
    .eq("clerk_id", clerkUserId)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    throw new Error(
      `The database rejected your sign-in (${error.message}). Check Supabase → Authentication → Third-party auth → Clerk (docs/DEPLOY.md).`,
    );
  }
  return data;
}

/** Signed-in user. First sign-in creates the rep's account; partners arrive via an invite link. */
export const getSession = cache(async (): Promise<Session> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const db = createServerSupabase();
  let member = await loadMember(db, clerkUserId);
  if (!member) {
    const u = await currentUser();
    const { acceptTeamInvite, bootstrapOwner } = await import("@/server/onboarding");
    const who = {
      clerkUserId,
      name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "",
      email: u?.primaryEmailAddress?.emailAddress ?? "",
    };
    // An invited teammate (Crystal, Ahn) gets a team login; anyone else may open an account.
    if (!(await acceptTeamInvite(who))) {
      const r = await bootstrapOwner(who);
      if (!r.ok) redirect(`/no-access?reason=${encodeURIComponent(r.reason)}`);
    }
    member = await loadMember(db, clerkUserId);
  }
  if (!member || !member.company || !isRole(member.role)) {
    throw new Error(
      "Your account isn't linked yet. Check that Supabase third-party auth for Clerk is configured (docs/DEPLOY.md).",
    );
  }
  return {
    db,
    clerkUserId,
    userId: member.id,
    companyId: member.company.id,
    companyName: member.company.name,
    timezone: member.company.timezone,
    role: member.role,
    name: member.name ?? "",
    partnerId: member.partner_id,
    settings: readSettings((member.company.settings_json ?? {}) as Record<string, unknown>),
  };
});

/** For server actions / route handlers: throws ForbiddenError when the role isn't allowed. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (roles.length && !roles.includes(session.role)) throw new ForbiddenError();
  return session;
}

/** Owner-only pages (Settings, Team): everyone else goes to Today. */
export async function requireOwner(): Promise<Session> {
  const session = await getSession();
  if (session.role === "team" || session.role === "partner") redirect("/today");
  if (session.role !== "owner") redirect("/no-access");
  return session;
}

/** Work pages (Today, deals, estimates, visits, jobs, KPIs): the whole team (0015). */
export async function requireStaff(): Promise<Session> {
  const session = await getSession();
  if (!isStaff(session.role)) redirect("/no-access");
  return session;
}

export const STAFF_ROLES = ["owner", "team", "partner"] as const;
export const isStaff = (role: Role) => (STAFF_ROLES as readonly string[]).includes(role);
