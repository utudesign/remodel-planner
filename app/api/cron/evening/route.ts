import { NextResponse, type NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { pushToUsers } from "@/server/push";

/**
 * Evening daily-report reminder (v3 F3). Vercel cron runs 23:00 and 00:00 UTC (vercel.json); the run that is
 * 7 PM in the company's time zone (EDT or EST) pushes every active worker who had a task on a job today and
 * hasn't sent that job's report. ?force=1 skips the hour check. Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const now = new Date();
  const db = createAdminSupabase();
  const { data: companies } = await db.from("companies").select("id, timezone");
  let reminded = 0;
  for (const c of companies ?? []) {
    const tz = c.timezone || "America/New_York";
    if (!force && formatInTimeZone(now, tz, "H") !== "19") continue;
    const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
    const [{ data: tasks }, { data: reports }, { data: crew }] = await Promise.all([
      db
        .from("tasks")
        .select("project_id, assignee_id, start_on, end_on")
        .eq("company_id", c.id)
        .neq("status", "done")
        .not("assignee_id", "is", null)
        .lte("start_on", today),
      db.from("daily_reports").select("project_id, author_id").eq("company_id", c.id).eq("report_date", today),
      db.from("users").select("id").eq("company_id", c.id).eq("role", "crew").eq("active", true),
    ]);
    const crewIds = new Set((crew ?? []).map((u) => u.id));
    const sent = new Set((reports ?? []).map((r) => `${r.project_id}:${r.author_id}`));
    const due = new Set<string>();
    for (const t of tasks ?? []) {
      if (!t.assignee_id || !crewIds.has(t.assignee_id) || !t.project_id) continue;
      if ((t.end_on ?? t.start_on ?? today) < today) continue; // finished window: Late lists handle it
      if (!sent.has(`${t.project_id}:${t.assignee_id}`)) due.add(t.assignee_id);
    }
    for (const id of due) {
      reminded += await pushToUsers([id], {
        kind: "daily_report_reminder",
        title: "Daily report",
        body: "60 seconds: how far did you get today, any problems, what's tomorrow?",
        url: "/work/report",
      });
    }
  }
  return NextResponse.json({ reminded });
}
