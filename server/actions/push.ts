"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { ok, run, type ActionState } from "@/server/action-utils";

const subSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  userAgent: z.string().max(300).optional(),
});

export async function savePushSubscription(input: z.input<typeof subSchema>): Promise<ActionState> {
  return run(async () => {
    const v = subSchema.parse(input);
    const s = await requireRole("owner", "partner");
    ok(
      await s.db.from("push_subscriptions").upsert(
        {
          company_id: s.companyId,
          user_id: s.userId,
          endpoint: v.endpoint,
          keys: v.keys,
          user_agent: v.userAgent ?? null,
        },
        { onConflict: "endpoint" },
      ),
    );
    return { ok: true, message: "Notifications on for this phone" };
  });
}

export async function removePushSubscription(input: { endpoint: string }): Promise<ActionState> {
  return run(async () => {
    const s = await requireRole("owner", "partner");
    ok(await s.db.from("push_subscriptions").delete().eq("endpoint", input.endpoint));
  });
}

export async function markNotificationsRead(): Promise<ActionState> {
  return run(async () => {
    const s = await requireRole("owner", "partner");
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
