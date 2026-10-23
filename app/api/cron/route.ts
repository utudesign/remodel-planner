import { NextResponse, type NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { DEFAULT_TZ, todayIn, dayBoundsUtc } from "@/lib/dates";
import { flushNotifications, pushToUsers } from "@/server/push";

/**
 * Scheduled work (vercel.json):
 *  - every run: send pending pushes; remind about scheduled client messages that are due
 *  - at 7:00 AM ET: each person's digest (CONTEXT §7). Vercel runs this at 11:00 and 12:00 UTC;
 *    only the run where it's 7 AM in New York sends the digest (DST-safe).
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = createAdminSupabase();
  const now = new Date();
  const result: Record<string, number> = {};

  result.pushed = (await flushNotifications()).sent;

  // Scheduled messages that are due → remind the person who wrote them + the lead owner.
  const { data: due } = await db
    .from("scheduled_messages")
    .select("id, body, channel, created_by, deal:deals(id, owner_id, contact:contacts(name))")
    .is("sent_at", null)
    .is("reminded_at", null)
    .lte("send_at", now.toISOString())
    .limit(100);
  let reminded = 0;
  for (const m of due ?? []) {
    const who = [m.created_by, m.deal?.owner_id].filter((x): x is string => !!x);
    reminded += await pushToUsers([...new Set(who)], {
      kind: "reminder",
      title: `Send now: ${m.channel === "sms" ? "text" : m.channel === "email" ? "email" : "call"} to ${m.deal?.contact?.name ?? "client"}`,
      body: m.body.slice(0, 140),
      url: m.deal ? `/deal/${m.deal.id}#messages` : "/command",
    });
    await db.from("scheduled_messages").update({ reminded_at: now.toISOString() }).eq("id", m.id);
  }
  result.reminded = reminded;

  const force = req.nextUrl.searchParams.get("digest") === "1";
  if (force || formatInTimeZone(now, DEFAULT_TZ, "H") === "7")
    result.digests = await sendDigests(now);
  return NextResponse.json(result);
}

async function sendDigests(now: Date) {
  const db = createAdminSupabase();
  const today = todayIn(DEFAULT_TZ, now);
  const { end } = dayBoundsUtc(today, DEFAULT_TZ);
  const [{ data: users }, { data: leads }, { data: meetings }] = await Promise.all([
    db.from("users").select("id, company_id, role").eq("active", true).neq("role", "crew"),
    db
      .from("deals")
      .select("owner_id, company_id, next_follow_up_at, stage:pipeline_stages!inner(key)")
      .not("stage.key", "in", "(won,lost)")
      .lt("next_follow_up_at", end.toISOString()),
    db
      .from("meetings")
      .select("assignee_id, scheduled_at")
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lt("scheduled_at", end.toISOString()),
  ]);
  let sent = 0;
  for (const u of users ?? []) {
    const mine = (leads ?? []).filter((l) => l.owner_id === u.id);
    const overdue = mine.filter(
      (l) => l.next_follow_up_at && new Date(l.next_follow_up_at) < now,
    ).length;
    const myMeetings = (meetings ?? []).filter((m) => m.assignee_id === u.id).length;
    const team = (leads ?? []).filter(
      (l) =>
        l.company_id === u.company_id && l.next_follow_up_at && new Date(l.next_follow_up_at) < now,
    ).length;
    if (!mine.length && !myMeetings && !team) continue;
    sent += await pushToUsers([u.id], {
      kind: "digest",
      title: `Your day: ${mine.length} follow-up${mine.length === 1 ? "" : "s"}, ${myMeetings} meeting${myMeetings === 1 ? "" : "s"}`,
      body: `${overdue} of yours overdue · ${team} overdue across the team`,
      url: "/today",
    });
  }
  return sent;
}
