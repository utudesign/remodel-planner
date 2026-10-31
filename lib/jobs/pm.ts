/**
 * Jobs project management (change request v3 items 13 + 15). Pure functions over a job's tasks, shared by the
 * Board, Timeline, List, My work and the job page; tested in tests/jobs-pm.test.ts.
 */

export type TaskStatus = "todo" | "doing" | "blocked" | "done";

export type PmTask = {
  id: string;
  project_id: string;
  title: string;
  phase_key: string | null;
  trade_key: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  pct: number;
  start_on: string | null; // yyyy-mm-dd
  end_on: string | null;
  start_time: string | null; // HH:MM[:SS]
  end_time: string | null;
  sort_order: number;
};

export type Phase = { key: string; label: string; sort_order: number };

export type DayHours = { start: string; end: string };
export type SiteRules = {
  building_type: string | null;
  hours: Partial<Record<Weekday, DayHours>>;
  loud_until: string | null;
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const DOW: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export function weekdayOf(ymd: string): Weekday {
  return DOW[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Job progress 0–100: the average % of its tasks (done = 100). */
export function progress(tasks: Pick<PmTask, "status" | "pct">[]): number {
  if (!tasks.length) return 0;
  const sum = tasks.reduce((n, t) => n + (t.status === "done" ? 100 : Math.max(0, Math.min(100, t.pct))), 0);
  return Math.round(sum / tasks.length);
}

/** The job's current phase = the first phase (by order) that still has an unfinished task; "done" when all are. */
export function currentPhase(tasks: PmTask[], phases: Phase[]): string {
  const order = new Map(phases.map((p) => [p.key, p.sort_order]));
  const open = tasks
    .filter((t) => t.phase_key && t.status !== "done")
    .sort((a, b) => (order.get(a.phase_key!) ?? 999) - (order.get(b.phase_key!) ?? 999) || a.sort_order - b.sort_order);
  if (open.length) return open[0].phase_key!;
  return tasks.some((t) => t.phase_key) ? "done" : (phases[0]?.key ?? "done");
}

export function isLate(t: Pick<PmTask, "status" | "end_on">, today: string): boolean {
  return t.status !== "done" && !!t.end_on && t.end_on < today;
}

/** The next unfinished task (by order). */
export function nextTask<T extends PmTask>(tasks: T[]): T | null {
  return [...tasks].filter((t) => t.status !== "done").sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
}

/**
 * Crew conflicts: the same person on two jobs on the same day. Returns task ids that clash, with the other task.
 * Only unfinished tasks with dates and an assignee count.
 */
export function crewConflicts(tasks: PmTask[]): Map<string, PmTask[]> {
  const out = new Map<string, PmTask[]>();
  const live = tasks.filter((t) => t.assignee_id && t.start_on && t.status !== "done");
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (a.assignee_id !== b.assignee_id || a.project_id === b.project_id) continue;
      const aEnd = a.end_on ?? a.start_on!;
      const bEnd = b.end_on ?? b.start_on!;
      if (a.start_on! <= bEnd && b.start_on! <= aEnd) {
        out.set(a.id, [...(out.get(a.id) ?? []), b]);
        out.set(b.id, [...(out.get(b.id) ?? []), a]);
      }
    }
  }
  return out;
}

const hm = (t: string | null) => (t ? t.slice(0, 5) : null);

/**
 * Site-rule warnings for one task (item 15): a planned day with no allowed work hours, a start before the
 * allowed start, or an end after the allowed end. Times are optional; without them only the days are checked.
 */
export function hoursWarnings(t: Pick<PmTask, "start_on" | "end_on" | "start_time" | "end_time" | "status">, rules: SiteRules | null): string[] {
  if (!rules || !t.start_on || t.status === "done") return [];
  const out: string[] = [];
  const end = t.end_on ?? t.start_on;
  const closed = new Set<string>();
  for (let d = t.start_on, n = 0; d <= end && n < 60; d = addDays(d, 1), n++) {
    const wd = weekdayOf(d);
    const h = rules.hours[wd];
    if (!h) {
      closed.add(WEEKDAYS.find((w) => w.key === wd)!.label);
      continue;
    }
    if (hm(t.start_time) && hm(t.start_time)! < h.start) out.push(`starts before ${fmt12(h.start)} on ${label(wd)}`);
    if (hm(t.end_time) && hm(t.end_time)! > h.end) out.push(`ends after ${fmt12(h.end)} on ${label(wd)}`);
  }
  if (closed.size) out.unshift(`no work allowed on ${[...closed].join(", ")}`);
  return [...new Set(out)];
}

function label(wd: Weekday) {
  return WEEKDAYS.find((w) => w.key === wd)!.label;
}

export function fmt12(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh}:00 ${ap}`;
}

/** One line for workers and the job header: "Condo · Mon–Fri 8:00 AM–9:00 PM · no loud work after 6:00 PM". */
export function rulesSummary(r: SiteRules | null): string {
  if (!r) return "";
  const parts: string[] = [];
  if (r.building_type) parts.push(r.building_type[0].toUpperCase() + r.building_type.slice(1));
  // Group consecutive days with the same hours.
  const groups: { from: Weekday; to: Weekday; h: DayHours }[] = [];
  for (const { key } of WEEKDAYS) {
    const h = r.hours[key];
    if (!h) continue;
    const g = groups.at(-1);
    const prevIdx = g ? WEEKDAYS.findIndex((w) => w.key === g.to) : -2;
    const idx = WEEKDAYS.findIndex((w) => w.key === key);
    if (g && g.h.start === h.start && g.h.end === h.end && prevIdx === idx - 1) g.to = key;
    else groups.push({ from: key, to: key, h });
  }
  for (const g of groups) {
    const days = g.from === g.to ? label(g.from) : `${label(g.from)}–${label(g.to)}`;
    parts.push(`${days} ${fmt12(g.h.start)}–${fmt12(g.h.end)}`);
  }
  if (!groups.length) parts.push("no work days set");
  if (r.loud_until) parts.push(`no loud work after ${fmt12(r.loud_until)}`);
  return parts.join(" · ");
}

/** My work buckets (Asana "My tasks"): overdue, today, next 7 days, later, no date. */
export type Bucket = "overdue" | "today" | "week" | "later" | "nodate";
export function bucketOf(t: Pick<PmTask, "start_on" | "end_on" | "status">, today: string): Bucket {
  if (t.end_on && t.end_on < today) return "overdue";
  if (!t.start_on) return "nodate";
  const end = t.end_on ?? t.start_on;
  if (t.start_on <= today && today <= end) return "today";
  if (t.start_on <= addDays(today, 7)) return "week";
  return "later";
}
