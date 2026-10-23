import { addDaysToDate, localToUtc, todayIn } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";

export type Window = { start: string; end: string };
export type BookingRules = { minutes: number; weekday: Window; saturday: Window };
export type Busy = { start: Date; end: Date };
export type Slot = { start: string; end: string; date: string; label: string };

const STEP_MIN = 30;
const BUFFER_MIN = 30; // drive time between visits
const LEAD_TIME_MIN = 4 * 60; // no same-afternoon surprises

function minutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function hm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Open visit slots for the next `days` days: weekday evenings + Saturdays (company settings),
 * in the company's time zone, skipping anything that overlaps a booked visit (+30 min buffer)
 * or starts within 4 hours. Sundays are off.
 */
export function availableSlots(rules: BookingRules, busy: Busy[], now: Date, tz: string, days = 14): Slot[] {
  const out: Slot[] = [];
  const today = todayIn(tz, now);
  for (let i = 0; i < days; i++) {
    const date = addDaysToDate(today, i);
    const dow = Number(formatInTimeZone(localToUtc(date, "12:00", tz), tz, "i")); // 1 Mon … 7 Sun
    const w = dow === 6 ? rules.saturday : dow <= 5 ? rules.weekday : null;
    if (!w) continue;
    for (let t = minutes(w.start); t + rules.minutes <= minutes(w.end); t += STEP_MIN) {
      const start = localToUtc(date, hm(t), tz);
      const end = new Date(start.getTime() + rules.minutes * 60_000);
      if (start.getTime() - now.getTime() < LEAD_TIME_MIN * 60_000) continue;
      const clash = busy.some(
        (b) => start.getTime() < b.end.getTime() + BUFFER_MIN * 60_000 && end.getTime() + BUFFER_MIN * 60_000 > b.start.getTime(),
      );
      if (clash) continue;
      out.push({
        start: start.toISOString(),
        end: end.toISOString(),
        date,
        label: formatInTimeZone(start, tz, "h:mm a"),
      });
    }
  }
  return out;
}
