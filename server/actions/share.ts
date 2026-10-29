"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { ok, run, type ActionState } from "@/server/action-utils";

const input = z.object({ dealId: z.uuid(), workspaceId: z.uuid(), share: z.boolean() });

/**
 * Share a deal with another workspace, or stop sharing it (0016). Only the deal's own
 * workspace can do either; the database checks that (share_deal / unshare_deal).
 */
export async function setDealShared(raw: { dealId: string; workspaceId: string; share: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = input.parse(raw);
    const s = await requireRole("owner", "team", "partner");
    ok(
      await s.db.rpc(v.share ? "share_deal" : "unshare_deal", { p_deal: v.dealId, p_workspace: v.workspaceId }),
    );
    revalidatePath("/deals", "layout");
    revalidatePath("/today");
    return { ok: true, message: v.share ? "Shared" : "Stopped sharing" };
  });
}
