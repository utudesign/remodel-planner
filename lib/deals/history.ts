/**
 * Deal History (change request v3 item 3). Turns the 0018 audit trail (audit_log: table, action,
 * old → new for the changed columns, who, when) and the activities log (calls, texts, notes, visits)
 * into one newest-first list a person can read. Pure: the page passes in the rows and the lookups.
 */

export type HistoryKind = "stage" | "change" | "checklist" | "file" | "estimate" | "visit" | "contact" | "note" | "job";

export const HISTORY_FILTERS: { key: HistoryKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "stage", label: "Stage" },
  { key: "change", label: "Edits" },
  { key: "checklist", label: "Checklist" },
  { key: "file", label: "Photos & files" },
  { key: "estimate", label: "Estimates" },
  { key: "visit", label: "Visits" },
  { key: "contact", label: "Calls & texts" },
  { key: "note", label: "Notes" },
  { key: "job", label: "Job" },
];

export type AuditRow = {
  id: number;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete" | string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  type: string;
  direction: string | null;
  summary: string;
  occurred_at: string;
  created_by: string | null;
};

export type HistoryLookups = {
  people: Map<string, string>;
  stages: Map<string, string>;
  lostReasons: Map<string, string>;
  requirements: Map<string, string>;
  /** quote id → "26-1047-E1" or "Draft v2" */
  quotes: Map<string, string>;
  photoTags: Map<string, string>;
  folders: Map<string, string>;
  /** UTC ISO → "Tue Nov 3, 6:00 PM" in the company time zone */
  formatTime: (iso: string) => string;
  formatMoney: (cents: number) => string;
};

export type HistoryEntry = {
  id: string;
  at: string;
  who: string;
  kind: HistoryKind;
  title: string;
  lines: string[];
};

const FIELD_LABELS: Record<string, string> = {
  title: "Name",
  name: "Name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  city: "Town",
  zip: "ZIP",
  scope: "Scope",
  source: "Source",
  timeline: "Timeline",
  budget_min_cents: "Budget from",
  budget_max_cents: "Budget up to",
  decision_maker: "Decision maker",
  owns_home: "Owns the home",
  knowledge_level: "Knows what they want",
  estimated_value_cents: "Estimated value",
  notes: "Notes",
  year_built: "Year built",
  owner_id: "Working it",
  sold_price_cents: "Sold price",
  change_orders_cents: "Change orders",
  deposit_received_at: "Deposit received",
  paid_in_full_at: "Paid in full",
  contract_signed_at: "Contract signed",
  sold_at: "Sold",
  first_response_at: "First reply",
  permit_required: "Permit required",
  workspace_id: "Workspace",
  job_status: "Job status",
  deleted_at: "Archived",
  cancelled_at: "Cancelled",
  lost_reason: "Lost reason",
  assignee_id: "Assignee",
  pct: "% complete",
  status: "Status",
  start_on: "Start",
  end_on: "Finish",
  start_time: "From",
  end_time: "Until",
  phase_key: "Phase",
  trade_key: "Trade",
  building_type: "Building",
  loud_until: "No loud work after",
  hours: "Work hours",
};

/** Fields shown as times / money / people. */
const TIME_FIELDS = /(_at|_on)$/;
const MONEY_FIELDS = /_cents$/;

function fmtValue(key: string, v: unknown, L: HistoryLookups): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "owner_id" || key === "assignee_id" || key.endsWith("_by")) return L.people.get(String(v)) ?? "someone";
  if (key === "pct" && typeof v === "number") return `${v}%`;
  if (key === "lost_reason") return L.lostReasons.get(String(v)) ?? String(v);
  if (key === "stage") return L.stages.get(String(v)) ?? String(v);
  if (MONEY_FIELDS.test(key) && typeof v === "number") return L.formatMoney(v);
  if (TIME_FIELDS.test(key) && typeof v === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : L.formatTime(v);
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return "changed";
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function label(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_cents$/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function changes(r: AuditRow, L: HistoryLookups, skip: string[] = []): string[] {
  const after = r.after ?? {};
  const before = r.before ?? {};
  return Object.keys(after)
    .filter((k) => !skip.includes(k))
    .map((k) => `${label(k)}: ${fmtValue(k, before[k], L)} → ${fmtValue(k, after[k], L)}`);
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function fromAudit(r: AuditRow, L: HistoryLookups): HistoryEntry[] {
  const who = r.actor_id ? (L.people.get(r.actor_id) ?? "Someone") : "The app";
  const base = { at: r.created_at, who };
  const a = r.after ?? {};
  const b = r.before ?? {};
  const id = `a${r.id}`;
  switch (r.table_name) {
    case "deals": {
      if (r.action === "insert") return [{ ...base, id, kind: "change", title: "Deal created", lines: [] }];
      const out: HistoryEntry[] = [];
      if ("stage" in a) {
        const lost = a.lost_reason ? ` (${fmtValue("lost_reason", a.lost_reason, L)})` : "";
        out.push({
          ...base,
          id: `${id}s`,
          kind: "stage",
          title: `Stage: ${fmtValue("stage", b.stage, L)} → ${fmtValue("stage", a.stage, L)}${lost}`,
          lines: [],
        });
      }
      if ("next_follow_up_at" in a) {
        out.push({
          ...base,
          id: `${id}f`,
          kind: "change",
          title: a.next_follow_up_at ? `Follow-up: ${fmtValue("next_follow_up_at", a.next_follow_up_at, L)}` : "Follow-up cleared",
          lines: b.next_follow_up_at ? [`was ${fmtValue("next_follow_up_at", b.next_follow_up_at, L)}`] : [],
        });
      }
      const rest = changes(r, L, ["stage", "lost_reason", "next_follow_up_at"]);
      if (rest.length) out.push({ ...base, id: `${id}c`, kind: "change", title: "Deal edited", lines: rest });
      return out;
    }
    case "contacts":
      return [{ ...base, id, kind: "change", title: "Customer edited", lines: changes(r, L) }];
    case "deal_files": {
      const row = r.action === "delete" ? b : { ...b, ...a };
      const photo = str(row.folder) === "photos";
      const what = photo
        ? `Photo${row.photo_tag ? ` (${L.photoTags.get(str(row.photo_tag)) ?? str(row.photo_tag)})` : ""}`
        : `File${row.title ? `: ${str(row.title)}` : ""} (${L.folders.get(str(row.folder)) ?? str(row.folder)})`;
      if (r.action === "insert") return [{ ...base, id, kind: "file", title: `${what} added`, lines: [] }];
      if ("deleted_at" in a && a.deleted_at) return [{ ...base, id, kind: "file", title: `${what} deleted`, lines: [] }];
      if ("photo_tag" in a) {
        return [{
          ...base, id, kind: "file", title: "Photo category changed",
          lines: [`${L.photoTags.get(str(b.photo_tag)) ?? (str(b.photo_tag) || "—")} → ${L.photoTags.get(str(a.photo_tag)) ?? str(a.photo_tag)}`],
        }];
      }
      return [{ ...base, id, kind: "file", title: `${what} edited`, lines: changes(r, L) }];
    }
    case "quotes": {
      const name = (r.record_id && L.quotes.get(r.record_id)) || `Draft v${str(a.version ?? b.version) || "?"}`;
      if (r.action === "insert") return [{ ...base, id, kind: "estimate", title: `Estimate created: ${name}`, lines: [] }];
      if (a.deleted_at) return [{ ...base, id, kind: "estimate", title: `Estimate deleted: ${name}`, lines: [] }];
      if ("archived_at" in a) {
        return [{ ...base, id, kind: "estimate", title: `Estimate ${a.archived_at ? "archived" : "restored"}: ${name}`, lines: [] }];
      }
      if (a.doc_number || a.sent_at) {
        return [{ ...base, id, kind: "estimate", title: `Estimate shown to the client: ${str(a.doc_number) || name}`, lines: [] }];
      }
      return [{ ...base, id, kind: "estimate", title: `Estimate edited: ${name}`, lines: changes(r, L, ["takeoff"]) }];
    }
    case "quote_line_items": {
      const row = r.action === "delete" ? b : { ...b, ...a };
      const item = [str(row.code), str(row.name)].filter(Boolean).join(" ") || "item";
      const line =
        r.action === "insert"
          ? `Added ${item}${row.qty !== undefined ? ` ×${str(row.qty)}` : ""}`
          : r.action === "delete"
            ? `Removed ${item}`
            : "qty" in a
              ? `${item}: qty ${str(b.qty)} → ${str(a.qty)}`
              : `${item} changed`;
      const quote = (str(row.quote_id) && L.quotes.get(str(row.quote_id))) || "estimate";
      return [{ ...base, id, kind: "estimate", title: `Estimate edited: ${quote}`, lines: [line] }];
    }
    case "meetings": {
      const row = { ...b, ...a };
      const when = row.starts_at ? fmtValue("starts_at", row.starts_at, L) : "";
      if (r.action === "insert") {
        return [{
          ...base, id, kind: "visit",
          title: row.status === "done" ? "Visit recorded as done" : `Visit booked: ${when}`,
          lines: row.booked_via === "link" ? ["Booked by the client"] : [],
        }];
      }
      if (r.action === "delete") return [{ ...base, id, kind: "visit", title: "Visit removed", lines: [] }];
      if ("status" in a) {
        return [{ ...base, id, kind: "visit", title: a.status === "done" ? "Visit done" : `Visit ${str(a.status)}: ${when}`, lines: [] }];
      }
      if ("starts_at" in a) {
        return [{ ...base, id, kind: "visit", title: `Visit moved to ${when}`, lines: [`was ${fmtValue("starts_at", b.starts_at, L)}`] }];
      }
      return [{ ...base, id, kind: "visit", title: "Visit edited", lines: changes(r, L) }];
    }
    case "site_visits":
      return [{
        ...base, id, kind: "visit",
        title: r.action === "insert" ? "Site visit form started" : "Site visit form updated",
        lines: Object.keys(a).filter((k) => !/ballpark|_cents$/.test(k)).map(label).slice(0, 6),
      }];
    case "deal_checklist_checks": {
      const req = L.requirements.get(str(a.requirement_id ?? b.requirement_id)) ?? "checklist item";
      return [{
        ...base, id, kind: "checklist",
        title: r.action === "insert" ? `✓ ${req} (checked by hand)` : `Unchecked: ${req}`,
        lines: a.note ? [str(a.note)] : [],
      }];
    }
    case "projects":
      return [{ ...base, id, kind: "job", title: r.action === "insert" ? "Job started" : "Job edited", lines: r.action === "insert" ? [] : changes(r, L) }];
    case "job_milestones": {
      const row = { ...b, ...a };
      if ("done_on" in a) {
        return [{ ...base, id, kind: "job", title: a.done_on ? `Job step done: ${str(row.label)}` : `Job step reopened: ${str(row.label)}`, lines: [] }];
      }
      if (r.action === "insert") return [{ ...base, id, kind: "job", title: `Job step added: ${str(row.label)}`, lines: [] }];
      if (r.action === "delete") return [{ ...base, id, kind: "job", title: `Job step removed: ${str(row.label)}`, lines: [] }];
      return [{ ...base, id, kind: "job", title: `Job step edited: ${str(row.label)}`, lines: changes(r, L) }];
    }
    case "tasks": {
      const row = { ...b, ...a };
      const t = str(row.title) || "task";
      if (r.action === "insert") return [{ ...base, id, kind: "job", title: `Task added: ${t}`, lines: [] }];
      if (r.action === "delete") return [{ ...base, id, kind: "job", title: `Task removed: ${t}`, lines: [] }];
      return [{ ...base, id, kind: "job", title: `Task: ${t}`, lines: changes(r, L) }];
    }
    case "task_comments": {
      const row = r.action === "delete" ? b : a;
      return [{
        ...base, id, kind: "job",
        title: r.action === "delete" ? "Task comment removed" : row.file_id ? "Task comment + photo" : "Task comment",
        lines: row.body ? [str(row.body)] : [],
      }];
    }
    case "site_rules":
      return [{ ...base, id, kind: "change", title: r.action === "insert" ? "Site rules added" : "Site rules edited", lines: changes(r, L, ["hours"]).concat("hours" in a && r.action === "update" ? ["Work hours changed"] : []) }];
    case "daily_reports": {
      const row = { ...b, ...a };
      const prog = Array.isArray(row.progress) ? (row.progress as { title?: string; pct_before?: number; pct_after?: number }[]) : [];
      const lines = prog
        .filter((p) => p.pct_before !== p.pct_after)
        .map((p) => `${p.title ?? "Task"}: ${p.pct_before ?? 0}% → ${p.pct_after ?? 0}%`);
      if (row.tomorrow_plan) lines.push(`Tomorrow: ${str(row.tomorrow_plan)}`);
      return [{ ...base, id, kind: "job", title: r.action === "insert" ? "Daily report" : "Daily report updated", lines }];
    }
    case "daily_report_issues": {
      const row = { ...b, ...a };
      if (r.action === "update" && "resolved_at" in a) {
        return [{ ...base, id, kind: "job", title: a.resolved_at ? "Job issue fixed" : "Job issue reopened", lines: row.note ? [str(row.note)] : [] }];
      }
      return [{ ...base, id, kind: "job", title: row.needs_reorder ? "Job issue · needs re-order" : "Job issue", lines: row.note ? [str(row.note)] : [] }];
    }
    case "costs":
    case "payments":
    case "change_orders": {
      const what = r.table_name === "costs" ? "Cost" : r.table_name === "payments" ? "Payment" : "Change order";
      const verb = r.action === "insert" ? "added" : r.action === "delete" ? "removed" : "edited";
      return [{ ...base, id, kind: "job", title: `${what} ${verb}`, lines: r.action === "update" ? changes(r, L) : [] }];
    }
    default:
      return [{ ...base, id, kind: "change", title: `${r.table_name} ${r.action}`, lines: changes(r, L) }];
  }
}

function fromActivity(x: ActivityRow, L: HistoryLookups): HistoryEntry | null {
  const who = x.created_by ? (L.people.get(x.created_by) ?? "Someone") : x.direction === "in" ? "Customer" : "The app";
  const dir = x.direction === "in" ? " in" : x.direction === "out" ? " out" : "";
  const kind: HistoryKind =
    x.type === "note" ? "note" : x.type === "visit" ? "visit" : x.type === "stage_change" ? "stage" : x.type === "system" ? "change" : "contact";
  const name: Record<string, string> = { call: "Call", text: "Text", email: "Email", fb_msg: "Facebook message", visit: "Visit", note: "Note" };
  return {
    id: `x${x.id}`,
    at: x.occurred_at,
    who,
    kind,
    title: x.type === "system" || x.type === "stage_change" ? x.summary : `${name[x.type] ?? x.type}${dir}`,
    lines: x.type === "system" || x.type === "stage_change" || !x.summary ? [] : [x.summary],
  };
}

/** Same person editing the same estimate within 15 minutes = one entry with all the changes. */
const MERGE_MS = 15 * 60_000;

export function buildHistory(audit: AuditRow[], activities: ActivityRow[], L: HistoryLookups): HistoryEntry[] {
  const all = [...audit.flatMap((r) => fromAudit(r, L)), ...activities.map((a) => fromActivity(a, L)).filter((e): e is HistoryEntry => !!e)];
  all.sort((p, q) => (p.at < q.at ? 1 : p.at > q.at ? -1 : p.id < q.id ? 1 : -1));
  const out: HistoryEntry[] = [];
  for (const e of all) {
    const prev = out[out.length - 1];
    if (
      prev &&
      e.kind === "estimate" &&
      prev.kind === "estimate" &&
      prev.title === e.title &&
      prev.who === e.who &&
      prev.title.startsWith("Estimate edited") &&
      Math.abs(Date.parse(prev.at) - Date.parse(e.at)) <= MERGE_MS
    ) {
      prev.lines.push(...e.lines);
      continue;
    }
    out.push({ ...e, lines: [...e.lines] });
  }
  for (const e of out) {
    if (e.lines.length > 8) e.lines = [...e.lines.slice(0, 7), `and ${e.lines.length - 7} more`];
  }
  return out;
}
