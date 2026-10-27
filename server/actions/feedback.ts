"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { FEEDBACK_KEYS } from "@/lib/feedback";
import { ok, run, type ActionState } from "@/server/action-utils";

/** Save my feedback on one area (0014). One row per person per area; saving again updates it. */
export async function saveFeedback(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        area: z.enum(FEEDBACK_KEYS),
        rating: z.preprocess((x) => (x === "" || x === undefined ? null : Number(x)), z.number().int().min(1).max(5).nullable()),
        works: z.string().trim().max(2000).optional().default(""),
        change: z.string().trim().max(2000).optional().default(""),
      })
      .parse(Object.fromEntries(fd));
    if (v.rating === null && !v.works && !v.change) throw new Error("Pick a rating or write a comment");
    const s = await requireRole("owner", "partner");
    ok(
      await s.db.from("app_feedback").upsert(
        {
          company_id: s.companyId,
          user_id: s.userId,
          area: v.area,
          rating: v.rating,
          works: v.works,
          change: v.change,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,area" },
      ),
    );
    revalidatePath("/feedback");
    return { ok: true, message: "Thanks! Saved." };
  });
}
