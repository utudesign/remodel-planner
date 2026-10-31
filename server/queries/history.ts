import type { Session } from "@/lib/auth/require-role";
import { formatDateTime } from "@/lib/dates";
import { FOLDER_LABELS, PHOTO_TAGS } from "@/lib/deals/display";
import { buildHistory, type ActivityRow, type AuditRow, type HistoryEntry } from "@/lib/deals/history";
import { formatCents } from "@/lib/money";
import { must } from "@/server/action-utils";

/**
 * A deal's History (change request v3 item 3): the 0018 audit trail + the activities log, newest first.
 * RLS decides what comes back (team: deals they can see; crew: nothing).
 */
export async function getDealHistory(s: Session, dealId: string): Promise<HistoryEntry[]> {
  const [audit, activities, people, stages, reasons, reqs, quotes] = await Promise.all([
    s.db
      .from("audit_log")
      .select("id, table_name, record_id, action, before, after, actor_id, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(must),
    s.db
      .from("activities")
      .select("id, type, direction, summary, occurred_at, created_by")
      .eq("deal_id", dealId)
      .order("occurred_at", { ascending: false })
      .limit(300)
      .then(must),
    s.db.from("users").select("id, name").eq("company_id", s.companyId).then(must),
    s.db.from("pipeline_stages").select("key, label").eq("company_id", s.companyId).then(must),
    s.db.from("lost_reasons").select("key, label").eq("company_id", s.companyId).then(must),
    s.db.from("document_requirements").select("id, label").eq("company_id", s.companyId).then(must),
    // Deleted estimates included: their history still needs a name.
    s.db.from("quotes").select("id, version, doc_number").eq("deal_id", dealId).then(must),
  ]);
  return buildHistory(audit as unknown as AuditRow[], activities as ActivityRow[], {
    people: new Map(people.map((p) => [p.id, p.name ?? "Someone"])),
    stages: new Map(stages.map((x) => [x.key, x.label])),
    lostReasons: new Map(reasons.map((x) => [x.key, x.label])),
    requirements: new Map(reqs.map((x) => [x.id, x.label])),
    quotes: new Map(quotes.map((q) => [q.id, q.doc_number ?? `Draft v${q.version}`])),
    photoTags: new Map(PHOTO_TAGS.map((t) => [t.key as string, t.label as string])),
    folders: new Map(Object.entries(FOLDER_LABELS)),
    formatTime: (iso) => formatDateTime(iso, s.timezone),
    formatMoney: (c) => formatCents(c),
  });
}
