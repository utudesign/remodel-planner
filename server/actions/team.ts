"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/app-url";
import { formToObject, ok, run, type ActionState } from "@/server/action-utils";

/** Invite a teammate (0015): an invite row (their login is created at first sign-in) + a Clerk email invitation. */
export async function inviteTeammate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ email: z.email().max(200), name: z.string().trim().max(120).optional().default("") })
      .parse(formToObject(fd));
    const s = await requireRole("owner");
    const email = v.email.toLowerCase();
    ok(
      await s.db
        .from("team_invites")
        .upsert({ company_id: s.companyId, email, name: v.name || null, accepted_at: null }, { onConflict: "company_id,email" }),
    );
    let sent = false;
    try {
      await (await clerkClient()).invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${await appUrl()}/sign-up`,
        ignoreExisting: true,
      });
      sent = true;
    } catch {
      sent = false; // Clerk not reachable / already a Clerk user: they can still sign in with this email
    }
    revalidatePath("/team");
    return {
      ok: true,
      message: sent
        ? `Invite emailed to ${email}. They sign in with that email and see the whole team's work.`
        : `Invite saved. Send ${await appUrl()}/sign-in and have them sign in with ${email}.`,
    };
  });
}

export async function cancelInvite(input: { id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const s = await requireRole("owner");
    ok(await s.db.from("team_invites").delete().eq("id", v.id).eq("company_id", s.companyId).is("accepted_at", null));
    revalidatePath("/team");
  });
}

/** Turn someone's sign-in off (or back on). Their deals and history stay; nothing is deleted. */
export async function setTeammateActive(input: { id: string; active: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid(), active: z.boolean() }).parse(input);
    const s = await requireRole("owner");
    if (v.id === s.userId) throw new Error("You can't turn off your own sign-in.");
    ok(await s.db.from("users").update({ active: v.active }).eq("id", v.id).eq("company_id", s.companyId).neq("role", "owner"));
    revalidatePath("/team");
  });
}
