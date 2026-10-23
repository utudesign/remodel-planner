import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Display timezone. Stored values are UTC (timestamptz) or plain calendar dates. */
export const DEFAULT_TZ = "America/New_York";

/** Days after the due date before an installment counts as overdue (spec §6). */
export const PAYMENT_GRACE_DAYS = 3;

/** Today's calendar date in the company timezone, as "YYYY-MM-DD". */
export function todayIn(tz = DEFAULT_TZ, now: Date = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

export function addDaysToDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** UTC instants bounding a local calendar day: [start, nextDayStart). */
export function dayBoundsUtc(date: string, tz = DEFAULT_TZ): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${date}T00:00:00`, tz),
    end: fromZonedTime(`${addDaysToDate(date, 1)}T00:00:00`, tz),
  };
}

/** Monday..Sunday (inclusive) of the week containing `date`. */
export function weekRange(date: string): { start: string; end: string } {
  const d = parseISO(date);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  const start = format(addDays(d, -dow), "yyyy-MM-dd");
  return { start, end: addDaysToDate(start, 6) };
}

/** Local wall-clock time on a calendar date → UTC instant. */
export function localToUtc(date: string, time: string, tz = DEFAULT_TZ): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? `${time}:00` : time}`, tz);
}

/** `<input type="datetime-local">` value (local) → UTC Date. */
export function datetimeLocalToUtc(value: string, tz = DEFAULT_TZ): Date {
  return fromZonedTime(value.length === 16 ? `${value}:00` : value, tz);
}

/** UTC → `<input type="datetime-local">` value in tz. */
export function utcToDatetimeLocal(value: Date | string, tz = DEFAULT_TZ): string {
  return formatInTimeZone(
    typeof value === "string" ? new Date(value) : value,
    tz,
    "yyyy-MM-dd'T'HH:mm",
  );
}

export function formatDateTime(value: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "—";
  return formatInTimeZone(
    typeof value === "string" ? new Date(value) : value,
    tz,
    "EEE MMM d, h:mm a",
  );
}

export function formatTime(value: Date | string, tz = DEFAULT_TZ): string {
  return formatInTimeZone(typeof value === "string" ? new Date(value) : value, tz, "h:mm a");
}

/** Calendar date "2026-10-23" → "Fri Oct 23". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "EEE MMM d");
}

/** Human "in 3 days" / "2 days ago" / "today" between two calendar dates. */
export function relativeDays(date: string, today: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Overdue = still due and the grace period after the due date has passed. */
export function isPaymentOverdue(
  p: { status: string; due_date: string | null },
  today: string,
): boolean {
  if (p.status !== "due" || !p.due_date) return false;
  return daysBetween(p.due_date, today) > PAYMENT_GRACE_DAYS;
}

/** A follow-up is overdue once its time has passed. */
export function isFollowUpOverdue(at: string | null, now: Date = new Date()): boolean {
  return !at || new Date(at).getTime() < now.getTime();
}
