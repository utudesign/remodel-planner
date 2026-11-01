import type { Session } from "@/lib/auth/require-role";
import { dayBoundsUtc, todayIn } from "@/lib/dates";
import { must } from "@/server/action-utils";
import { getStages, listDeals } from "@/server/queries/deals";

const DAY = 86400_000;

/** Today: what to do now. Sales work is per person (my deals); job steps are the whole team's (0015). */
export async function getToday(s: Session, now = new Date()) {
  const today = todayIn(s.timezone, now);
  const { start, end } = dayBoundsUtc(today, s.timezone);
  const soon = new Date(start.getTime() + 2 * DAY).toISOString().slice(0, 10);
  const [stages, deals, meetingsRes, stepsRes] = await Promise.all([
    getStages(s),
    listDeals(s),
    s.db
      .from("meetings")
      .select("id, starts_at, kind, deal:deals(deal_number, scope, title, owner_id, contact:contacts(name, phone, address, city, zip))")
      .eq("company_id", s.companyId)
      .eq("status", "scheduled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    // Job steps due within 2 days (or late).
    s.db
      .from("job_milestones")
      .select("id, label, planned_on, project:projects(deal:deals(deal_number, scope, title, contact:contacts(name)))")
      .eq("company_id", s.companyId)
      .is("done_on", null)
      .lte("planned_on", soon)
      .order("planned_on")
      .limit(30),
  ]);
  const mine = deals.filter((d) => d.owner_id === s.userId);
  const meetings = must(meetingsRes).filter((m) => m.deal?.owner_id === s.userId);
  const kind = new Map(stages.map((x) => [x.key, x.kind]));
  const open = mine.filter((d) => kind.get(d.stage) === "open");

  const replyNow = open.filter((d) => d.stage === "new" && !d.first_response_at);
  const replyIds = new Set(replyNow.map((d) => d.id));
  const followUps = open
    .filter((d) => !replyIds.has(d.id) && d.stage !== "ready")
    .filter((d) => d.next_follow_up_at && new Date(d.next_follow_up_at) < end)
    .sort((a, b) => (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? ""));
  const noTouch = open.filter(
    (d) =>
      !replyIds.has(d.id) &&
      !followUps.includes(d) &&
      now.getTime() - new Date(d.last_touch_at ?? d.created_at ?? now).getTime() > 2 * DAY,
  );
  const ready = open.filter((d) => d.stage === "ready");
  const jobSteps = must(stepsRes).filter((m) => m.project?.deal);

  return { today, replyNow, followUps, noTouch, ready, meetings, jobSteps };
}

/**
 * Today v2 (v3 E2) job side: who's on site today (with site rules), today's worker reports, open job issues,
 * and installments waiting on the client (link sent, or past due). Workspace rules apply through RLS.
 */
export async function getTodayJobs(s: Session, now = new Date()) {
  const today = todayIn(s.timezone, now);
  const [tasksRes, reportsRes, issuesRes, paysRes, phasesRes] = await Promise.all([
    s.db
      .from("tasks")
      .select(
        "id, title, phase_key, status, pct, start_on, end_on, start_time, assignee:users(name), project:projects(id, deal:deals(id, deal_number, title, scope, contact:contacts(name, phone, address, city, zip)))",
      )
      .eq("company_id", s.companyId)
      .neq("status", "done")
      .lte("start_on", today)
      .gte("end_on", today)
      .order("start_time", { nullsFirst: false })
      .limit(60),
    s.db
      .from("daily_reports")
      .select("id, project_id, created_at, author:users(name), project:projects(deal:deals(deal_number, title, scope, contact:contacts(name)))")
      .eq("company_id", s.companyId)
      .eq("report_date", today)
      .order("created_at", { ascending: false })
      .limit(20),
    s.db
      .from("daily_report_issues")
      .select("id, type_key, note, needs_reorder, created_at, project:projects(deal:deals(deal_number, title, scope, contact:contacts(name)))")
      .eq("company_id", s.companyId)
      .is("resolved_at", null)
      .order("needs_reorder", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    s.db
      .from("payments")
      .select("id, label, amount, due_date, link_sent_at, project:projects(deal:deals(deal_number, title, scope, contact:contacts(name)))")
      .eq("company_id", s.companyId)
      .is("received_at", null)
      .or(`link_sent_at.not.is.null,due_date.lt.${today}`)
      .order("due_date", { nullsFirst: false })
      .limit(20),
    s.db.from("job_issue_types").select("key, label").eq("company_id", s.companyId),
  ]);
  const tasks = must(tasksRes).filter((t) => t.project?.deal);
  const dealIds = [...new Set(tasks.map((t) => t.project!.deal!.id))];
  const rules = dealIds.length
    ? must(await s.db.from("site_rules").select("deal_id, building_type, hours, loud_until").in("deal_id", dealIds))
    : [];
  // One row per job on site today.
  const onSite = new Map<
    string,
    { dealId: string; number: string; name: string; scope: string | null; phone: string | null; address: string; people: Set<string>; tasks: string[] }
  >();
  for (const t of tasks) {
    const d = t.project!.deal!;
    const row =
      onSite.get(d.id) ??
      {
        dealId: d.id,
        number: d.deal_number ?? "",
        name: d.contact?.name || d.title || "Job",
        scope: d.scope,
        phone: d.contact?.phone ?? null,
        address: [d.contact?.address, d.contact?.city, d.contact?.zip].filter(Boolean).join(", "),
        people: new Set<string>(),
        tasks: [],
      };
    const who = (t.assignee as { name: string | null } | null)?.name;
    if (who) row.people.add(who.split(" ")[0]);
    row.tasks.push(t.title ?? "Task");
    onSite.set(d.id, row);
  }
  const issueLabel = new Map(must(phasesRes).map((x) => [x.key, x.label]));
  return {
    today,
    onSite: [...onSite.values()].map((j) => ({ ...j, people: [...j.people], rules: rules.find((r) => r.deal_id === j.dealId) ?? null })),
    reports: must(reportsRes).filter((r) => r.project?.deal),
    issues: must(issuesRes)
      .filter((i) => i.project?.deal)
      .map((i) => ({ ...i, type: issueLabel.get(i.type_key) ?? i.type_key })),
    unpaid: must(paysRes)
      .map((p) => ({ ...p, project: p.project as unknown as { deal: { deal_number: string | null; title: string | null; scope: string | null; contact: { name: string | null } | null } | null } | null }))
      .filter((p) => p.project?.deal),
  };
}
