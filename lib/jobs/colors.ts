/**
 * Asana-style tag colors for the job views (trades, statuses, phases). Deterministic: a trade keeps its color
 * by its place in Settings → Jobs. Each entry: chip (bg + text), bar (timeline/calendar fill).
 */
export type Swatch = { chip: string; bar: string; dot: string };

export const PALETTE: Swatch[] = [
  { chip: "bg-sky-200 text-sky-950", bar: "bg-sky-300 text-sky-950", dot: "bg-sky-400" },
  { chip: "bg-orange-200 text-orange-950", bar: "bg-orange-300 text-orange-950", dot: "bg-orange-400" },
  { chip: "bg-fuchsia-200 text-fuchsia-950", bar: "bg-fuchsia-300 text-fuchsia-950", dot: "bg-fuchsia-400" },
  { chip: "bg-emerald-200 text-emerald-950", bar: "bg-emerald-300 text-emerald-950", dot: "bg-emerald-400" },
  { chip: "bg-amber-200 text-amber-950", bar: "bg-amber-300 text-amber-950", dot: "bg-amber-400" },
  { chip: "bg-violet-200 text-violet-950", bar: "bg-violet-300 text-violet-950", dot: "bg-violet-400" },
  { chip: "bg-teal-200 text-teal-950", bar: "bg-teal-300 text-teal-950", dot: "bg-teal-400" },
  { chip: "bg-rose-200 text-rose-950", bar: "bg-rose-300 text-rose-950", dot: "bg-rose-400" },
];

export function swatchFor(key: string | null | undefined, order: readonly { key: string }[]): Swatch | null {
  if (!key) return null;
  const i = order.findIndex((x) => x.key === key);
  return PALETTE[(i >= 0 ? i : Math.abs([...key].reduce((a, c) => a + c.charCodeAt(0), 0))) % PALETTE.length];
}

export const STATUS_STYLE: Record<string, { label: string; chip: string }> = {
  todo: { label: "To do", chip: "bg-zinc-200 text-zinc-800" },
  doing: { label: "In progress", chip: "bg-sky-200 text-sky-950" },
  blocked: { label: "Blocked", chip: "bg-rose-200 text-rose-950" },
  done: { label: "Done", chip: "bg-emerald-200 text-emerald-950" },
};

/** On track / At risk / Off track from the tasks themselves (no status to keep up to date by hand). */
export function jobHealth(tasks: { status: string; end_on: string | null }[], today: string): { key: "on" | "risk" | "off"; label: string; dot: string } {
  const late = tasks.filter((t) => t.status !== "done" && t.end_on && t.end_on < today);
  const blocked = tasks.some((t) => t.status === "blocked");
  const veryLate = late.some((t) => (Date.parse(today) - Date.parse(t.end_on!)) / 86_400_000 > 3);
  if (veryLate || late.length > 2) return { key: "off", label: "Off track", dot: "bg-rose-500" };
  if (late.length || blocked) return { key: "risk", label: "At risk", dot: "bg-amber-500" };
  return { key: "on", label: "On track", dot: "bg-emerald-500" };
}
