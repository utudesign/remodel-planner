"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { ForbiddenError, requireRole } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/app-url";
import { formToObject, ok, run, type ActionState } from "@/server/action-utils";

/** The owner or a workspace admin (Crystal) manages the people in their own workspace (0016). */
async function requireWsAdmin() {
  const s = await requireRole("owner", "team", "partner");
  if (!s.isWsAdmin) throw new ForbiddenError("Only the workspace admin can do that.");
  return s;
}

/** Invite a teammate (0015): an invite row (their login is created at first sign-in) + a Clerk email invitation. */
export async function inviteTeammate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ email: z.email().max(200), name: z.string().trim().max(120).optional().default("") })
      .parse(formToObject(fd));
    const s = await requireWsAdmin();
    const email = v.email.toLowerCase();
    ok(
      await s.db
        .from("team_invites")
        .upsert(
          { company_id: s.companyId, workspace_id: s.workspaceId, email, name: v.name || null, accepted_at: null },
          { onConflict: "company_id,email" },
        ),
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
        ? `Invite emailed to ${email}. They sign in with that email and see this workspace's deals.`
        : `Invite saved. Send ${await appUrl()}/sign-in and have them sign in with ${email}.`,
    };
  });
}

export async function cancelInvite(input: { id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const s = await requireWsAdmin();
    ok(await s.db.from("team_invites").delete().eq("id", v.id).eq("company_id", s.companyId).is("accepted_at", null));
    revalidatePath("/team");
  });
}

/** Turn someone's sign-in off (or back on). Their deals and history stay; nothing is deleted. */
export async function setTeammateActive(input: { id: string; active: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid(), active: z.boolean() }).parse(input);
    const s = await requireWsAdmin();
    if (v.id === s.userId) throw new Error("You can't turn off your own sign-in.");
    const q = s.db.from("users").update({ active: v.active }).eq("id", v.id).eq("company_id", s.companyId).neq("role", "owner");
    ok(await (s.role === "owner" ? q : q.eq("workspace_id", s.workspaceId)));
    revalidatePath("/team");
  });
}

/**
 * The owner gives a teammate her own workspace (0016): she becomes its admin, starts with no
 * deals, and nobody else sees what she adds until she shares a deal.
 */
export async function giveOwnWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ user_id: z.uuid(), name: z.string().trim().min(1, "Name the workspace").max(80) }).parse(formToObject(fd));
    const s = await requireRole("owner");
    ok(await s.db.rpc("create_workspace_for", { p_user: v.user_id, p_name: v.name }));
    revalidatePath("/team");
    revalidatePath("/deals");
    return { ok: true, message: `${v.name} is ready. They sign in as usual and start with an empty board.` };
  });
}

export async function renameWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ name: z.string().trim().min(1, "Name the workspace").max(80) }).parse(formToObject(fd));
    const s = await requireWsAdmin();
    ok(await s.db.from("workspaces").update({ name: v.name }).eq("id", s.workspaceId).eq("company_id", s.companyId));
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved" };
  });
}

/** The owner moves a teammate into another workspace as a member (e.g. Ahn joins Crystal's). */
export async function moveToWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ user_id: z.uuid(), workspace_id: z.uuid() }).parse(formToObject(fd));
    const s = await requireRole("owner");
    ok(await s.db.rpc("move_to_workspace", { p_user: v.user_id, p_workspace: v.workspace_id }));
    revalidatePath("/team");
    return { ok: true, message: "Moved" };
  });
}
