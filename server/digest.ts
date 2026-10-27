import { createAdminSupabase } from "@/lib/supabase/admin";
import { dayBoundsUtc, todayIn } from "@/lib/dates";

/** The 3:30 PM digest: what piled up during the day job. Service role (cron only). */
export async function digestFor(companyId: string, tz: string, now: Date) {
  const db = createAdminSupabase();
  const today = todayIn(tz, now);
  const { end } = dayBoundsUtc(today, tz);
  const [{ data: stages }, { data: deals }, { data: visits }] = await Promise.all([
    db.from("pipeline_stages").select("key, kind").eq("company_id", companyId),
    db
      .from("deals")
      .select("stage, first_response_at, next_follow_up_at")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    db
      .from("meetings")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "scheduled")
      .gte("starts_at", now.toISOString())
      .lt("starts_at", end.toISOString()),
  ]);
  const open = new Set((stages ?? []).filter((s) => s.kind === "open").map((s) => s.key));
  const mine = (deals ?? []).filter((d) => open.has(d.stage));
  const unanswered = mine.filter((d) => d.stage === "new" && !d.first_response_at).length;
  const due = mine.filter((d) => d.next_follow_up_at && new Date(d.next_follow_up_at) < end).length;
  const tonight = visits?.length ?? 0;
  if (!unanswered && !due && !tonight) return null;
  const parts = [
    unanswered ? `${unanswered} new lead${unanswered === 1 ? "" : "s"} to answer` : null,
    tonight ? `${tonight} visit${tonight === 1 ? "" : "s"} tonight` : null,
    due ? `${due} follow-up${due === 1 ? "" : "s"} due` : null,
  ].filter(Boolean);
  return { title: "Day job's done. Here's your list", body: parts.join(" · ") };
}
