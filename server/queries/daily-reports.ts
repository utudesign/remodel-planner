import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";
import { signedUrls } from "@/lib/storage";

/** Daily reports + issues (v3 F3, 0023) for the team: one job's feed, and open issues for Today. */

export type ReportIssue = {
  id: string;
  type: string;
  note: string;
  needs_reorder: boolean;
  resolved: boolean;
  photo: string | null;
};
export type ReportFeedItem = {
  id: string;
  date: string;
  author: string;
  created_at: string;
  tomorrow: string | null;
  progress: { title: string; pct_before: number; pct_after: number }[];
  issues: ReportIssue[];
};

export async function listJobReports(s: Session, projectId: string, limit = 14): Promise<ReportFeedItem[]> {
  const [reports, types] = await Promise.all([
    s.db
      .from("daily_reports")
      .select(
        "id, report_date, created_at, updated_at, tomorrow_plan, progress, author:users(name), issues:daily_report_issues(id, type_key, note, needs_reorder, resolved_at, file:deal_files(storage_path))",
      )
      .eq("project_id", projectId)
      .order("report_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit)
      .then(must),
    s.db.from("job_issue_types").select("key, label").eq("company_id", s.companyId).then(must),
  ]);
  const label = new Map(types.map((t) => [t.key, t.label]));
  const paths = reports.flatMap((r) => r.issues.map((i) => (i.file as { storage_path: string } | null)?.storage_path).filter((p): p is string => !!p));
  const urls = await signedUrls(paths, s.companyId);
  return reports.map((r) => ({
    id: r.id,
    date: r.report_date,
    author: (r.author as { name: string | null } | null)?.name ?? "Worker",
    created_at: r.updated_at ?? r.created_at,
    tomorrow: r.tomorrow_plan,
    progress: (Array.isArray(r.progress) ? r.progress : []) as ReportFeedItem["progress"],
    issues: r.issues.map((i) => ({
      id: i.id,
      type: label.get(i.type_key) ?? i.type_key,
      note: i.note,
      needs_reorder: i.needs_reorder,
      resolved: !!i.resolved_at,
      photo: urls[(i.file as { storage_path: string } | null)?.storage_path ?? ""] ?? null,
    })),
  }));
}

/** Open issues across the jobs I can see (Today). */
export async function listOpenIssues(s: Session) {
  const [rows, types] = await Promise.all([
    s.db
      .from("daily_report_issues")
      .select("id, type_key, note, needs_reorder, created_at, project:projects(deal:deals(deal_number, title))")
      .eq("company_id", s.companyId)
      .is("resolved_at", null)
      .order("needs_reorder", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20)
      .then(must),
    s.db.from("job_issue_types").select("key, label").eq("company_id", s.companyId).then(must),
  ]);
  const label = new Map(types.map((t) => [t.key, t.label]));
  return rows.map((r) => {
    const deal = (r.project as { deal: { deal_number: string | null; title: string | null } | null } | null)?.deal;
    return {
      id: r.id,
      type: label.get(r.type_key) ?? r.type_key,
      note: r.note,
      needs_reorder: r.needs_reorder,
      created_at: r.created_at,
      number: deal?.deal_number ?? "",
      title: deal?.title ?? "",
    };
  });
}
