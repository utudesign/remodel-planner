import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDaysToDate, todayIn } from "@/lib/dates";

/**
 * Follow-up quick buttons (+1 day, +3 days, +1 week; change request v3 item 4).
 * Counted from **today** (a snooze, not "from the old date"), at the clock time the follow-up already had,
 * or 9:00 AM when there was none. Everything in the company time zone (America/New_York).
 */
export function bumpFollowUp(current: Date | null, now: Date, days: number, tz: string): Date {
  const time = current ? formatInTimeZone(current, tz, "HH:mm") : "09:00";
  const day = addDaysToDate(todayIn(tz, now), days);
  return fromZonedTime(`${day}T${time}:00`, tz);
}

/** "Follow up Tue 6:00 PM" this week; "Follow up Tue Nov 10, 6:00 PM" further out; "Today 6:00 PM" / "Tomorrow". */
export function followUpLabel(at: Date, now: Date, tz: string): string {
  const today = todayIn(tz, now);
  const day = formatInTimeZone(at, tz, "yyyy-MM-dd");
  const time = formatInTimeZone(at, tz, "h:mm a");
  if (day === today) return `Today ${time}`;
  if (day === addDaysToDate(today, 1)) return `Tomorrow ${time}`;
  if (day === addDaysToDate(today, -1)) return `Yesterday ${time}`;
  const diff = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000;
  if (diff > 0 && diff < 7) return formatInTimeZone(at, tz, "EEE h:mm a");
  return formatInTimeZone(at, tz, "EEE MMM d, h:mm a");
}
