import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ, addDaysToDate, localToUtc } from "@/lib/dates";
import { isInWindow, type WorkWindow } from "@/lib/routing";

export type ShiftKind = "live" | "back_office";

/** Shift checklists (FIELD-AND-OFFICE §7). Keys are stable; labels can change. */
export const CHECKLISTS: Record<ShiftKind, { key: string; label: string }[]> = {
  live: [
    {
      key: "clear_1_2",
      label: "Clear new leads + follow-ups in the first 30 minutes; keep them at zero",
    },
    { key: "book_confirm", label: "Book visits and confirm tomorrow's" },
    { key: "payments", label: "Payment reminders by phone" },
    { key: "handoff", label: "Post the shift handoff before leaving" },
  ],
  back_office: [
    {
      key: "review_visits",
      label: "Review every site visit submitted today; ask for missing info",
    },
    {
      key: "queue_texts",
      label: "Queue tomorrow's follow-up texts for 8:00 AM (nothing goes to clients now)",
    },
    { key: "orders", label: "Update orders + deliveries from supplier emails" },
    { key: "hygiene", label: "Data hygiene to zero" },
    { key: "brief", label: "Write the morning brief (publishes 7:00 AM ET)" },
  ],
};

/**
 * Which shift am I in (or which one is closest)? Returns the kind and the ET date the shift started,
 * so an overnight back-office shift that crosses midnight keeps one checklist.
 */
export function currentShift(
  windows: WorkWindow[],
  at: Date = new Date(),
  tz = DEFAULT_TZ,
): { kind: ShiftKind; shiftDate: string; inWindow: boolean } {
  const today = formatInTimeZone(at, tz, "yyyy-MM-dd");
  for (const w of windows) {
    if ((w.kind === "live" || w.kind === "back_office") && isInWindow(w, at, tz)) {
      const localMin =
        Number(formatInTimeZone(at, tz, "H")) * 60 + Number(formatInTimeZone(at, tz, "m"));
      const [sh, sm] = w.start_time.split(":").map(Number);
      const startedYesterday = localMin < sh * 60 + (sm || 0);
      return {
        kind: w.kind,
        shiftDate: startedYesterday ? addDaysToDate(today, -1) : today,
        inWindow: true,
      };
    }
  }
  const hour = Number(formatInTimeZone(at, tz, "H"));
  // Outside any window: daytime → live checklist, night → back office.
  return hour >= 8 && hour < 21
    ? { kind: "live", shiftDate: today, inWindow: false }
    : {
        kind: "back_office",
        shiftDate: hour < 8 ? addDaysToDate(today, -1) : today,
        inWindow: false,
      };
}

/** Next 7:00 AM ET after `at` (morning brief publish time). */
export function nextMorning(at: Date = new Date(), tz = DEFAULT_TZ, time = "07:00"): Date {
  const today = formatInTimeZone(at, tz, "yyyy-MM-dd");
  const t = localToUtc(today, time, tz);
  return t > at ? t : localToUtc(formatInTimeZone(addDays(at, 1), tz, "yyyy-MM-dd"), time, tz);
}
