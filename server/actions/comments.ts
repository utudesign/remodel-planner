"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { parseMentions } from "@/lib/mentions";
import { uploadImages } from "@/lib/storage";
import { formToObject, maybe, must, ok, run, type ActionState } from "@/server/action-utils";
import { flushNotifications } from "@/server/push";

const schema = z.object({
  entity_type: z.enum(["lead", "project", "task"]),
  entity_id: z.uuid(),
  body: z.string().trim().min(1, "write something").max(4000),
});

/** Comment with @mentions and photos on a lead, job or task. Crew can comment on their own jobs (RLS). */
export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = schema.parse(formToObject(fd));
    const s = await requireRole("owner", "team", "crew");
    let leadId: string | null = null;
    let projectId: string | null = null;
    if (v.entity_type === "lead") {
      if (s.role === "crew") throw new Error("Crew can't comment on leads");
      leadId = v.entity_id;
    } else if (v.entity_type === "project") {
      projectId = v.entity_id;
    } else {
      const t = maybe(
        await s.db.from("tasks").select("project_id").eq("id", v.entity_id).maybeSingle(),
      );
      if (!t) throw new Error("Task not found");
      projectId = t.project_id;
    }
    const members = must(await s.db.from("users").select("id, name, role, active"));
    const mentions = parseMentions(
      v.body,
      members.filter((m) => m.active && (projectId || m.role !== "crew")),
    );
    const photos = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    const photo_paths = photos.length
      ? await uploadImages(photos, s.companyId, `comments/${leadId ?? projectId}`)
      : [];
    ok(
      await s.db.from("comments").insert({
        company_id: s.companyId,
        entity_type: v.entity_type,
        entity_id: v.entity_id,
        lead_id: leadId,
        project_id: projectId,
        author_id: s.userId,
        body: v.body,
        mentions,
        photo_paths,
      }),
    );
    after(() => flushNotifications(s.companyId));
    revalidatePath(leadId ? `/leads/${leadId}` : `/projects/${projectId}`);
    revalidatePath("/activity");
    return { ok: true, message: mentions.length ? `Sent · ${mentions.length} notified` : "Posted" };
  });
}

export async function markNotificationsRead(): Promise<ActionState> {
  return run(async () => {
    const s = await requireRole("owner", "team", "crew");
    ok(
      await s.db
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", s.userId)
        .is("read_at", null),
    );
    revalidatePath("/", "layout");
  });
}
