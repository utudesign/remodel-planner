import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ } from "@/lib/dates";

export type Workday = { days: number[]; start: string; end: string };

/** ISO weekday (1 = Mon … 7 = Sun) and "HH:mm" of an instant in tz. */
function local(now: Date, tz: string) {
  return { dow: Number(formatInTimeZone(now, tz, "i")), hm: formatInTimeZone(now, tz, "HH:mm") };
}

/** True during the day job (weekdays 7:00 AM–3:30 PM ET by default): no pushes except new leads. */
export function isDayJob(now: Date, w: Workday, tz = DEFAULT_TZ): boolean {
  const { dow, hm } = local(now, tz);
  return w.days.includes(dow) && hm >= w.start && hm < w.end;
}

/**
 * Cron runs twice (19:30 and 20:30 UTC, Mon–Fri) so one of them is 3:30 PM in New York in
 * both EDT and EST. Send only from the run whose local hour matches the digest time.
 */
export function isDigestRun(now: Date, digestTime: string, days: number[], tz = DEFAULT_TZ): boolean {
  const { dow, hm } = local(now, tz);
  return days.includes(dow) && hm.slice(0, 2) === digestTime.slice(0, 2);
}
