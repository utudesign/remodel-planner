import { revalidatePath } from "next/cache";
import type { Session } from "@/lib/auth/require-role";
import { must, ok } from "@/server/action-utils";

/** Helpers for the deal jacket actions (v3 batch B). Not a "use server" module: nothing here is callable from the browser. */

export async function jacketDeal(s: Session, dealId: string) {
  return must(
    await s.db
      .from("deals")
      .select("id, deal_number, stage, next_follow_up_at")
      .eq("id", dealId)
      .eq("company_id", s.companyId)
      .single(),
  );
}

export function revalidateJacket(number: string | null) {
  revalidatePath("/deals");
  revalidatePath("/today");
  if (number) revalidatePath(`/deals/${number}`);
}

/**
 * Visit done (shared by "Mark as visited" and a booked visit's ✓):
 *   - the booked visit (if any) → done; with no booking, a done visit is recorded now;
 *   - the deal moves to visit_done if it's earlier in the pipeline (by the stages' order, not a fixed list);
 *   - a "Site visit done" activity, which resets the follow-up from follow_up_rules (database).
 */
export async function completeVisit(s: Session, dealId: string, meetingId?: string | null) {
  const d = await jacketDeal(s, dealId);
  if (meetingId) {
    ok(await s.db.from("meetings").update({ status: "done" }).eq("id", meetingId).eq("deal_id", d.id));
  } else {
    // The booked visit closest to now, if there is one.
    const open = must(
      await s.db
        .from("meetings")
        .select("id, starts_at")
        .eq("deal_id", d.id)
        .eq("kind", "visit")
        .eq("status", "scheduled")
        .order("starts_at"),
    );
    const now = Date.now();
    const pick = open.sort(
      (a, b) => Math.abs(Date.parse(a.starts_at) - now) - Math.abs(Date.parse(b.starts_at) - now),
    )[0];
    if (pick) {
      ok(await s.db.from("meetings").update({ status: "done" }).eq("id", pick.id));
    } else {
      ok(
        await s.db.from("meetings").insert({
          company_id: s.companyId,
          deal_id: d.id,
          kind: "visit",
          starts_at: new Date().toISOString(),
          status: "done",
          booked_via: "manual",
          notes: "Marked as visited",
        }),
      );
    }
  }
  const stages = must(
    await s.db
      .from("pipeline_stages")
      .select("key, kind, sort_order")
      .eq("company_id", s.companyId),
  );
  const cur = stages.find((x) => x.key === d.stage);
  const target = stages.find((x) => x.key === "visit_done");
  if (cur && target && cur.kind === "open" && cur.sort_order < target.sort_order) {
    ok(await s.db.from("deals").update({ stage: target.key }).eq("id", d.id));
  }
  ok(
    await s.db.from("activities").insert({
      company_id: s.companyId,
      deal_id: d.id,
      type: "visit",
      direction: "out",
      summary: "Site visit done",
      created_by: s.userId,
    }),
  );
  revalidateJacket(d.deal_number);
}

