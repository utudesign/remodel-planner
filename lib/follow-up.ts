import { addDays, addHours } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ, localToUtc } from "@/lib/dates";

export type FollowUpRule = { sequence: number; offset_days: number; offset_hours: number };

/** Hour (local) that day-based follow-ups snap to. */
export const FOLLOW_UP_HOUR = "09:00";

function snapToMorning(instant: Date, tz: string): Date {
  return localToUtc(formatInTimeZone(instant, tz, "yyyy-MM-dd"), FOLLOW_UP_HOUR, tz);
}

/**
 * Suggests the next follow-up for a lead.
 * - Rules come from Settings (per stage, in sequence) and count from when the lead entered the stage.
 * - `attempt` = how many outbound touches have been logged since entering the stage (0 = first).
 * - Day offsets snap to 9:00 AM local; hour offsets are exact.
 * - If the rule's time has already passed, it moves forward (next morning / now + hours).
 * - Past the last rule, repeat the gap of the last rule (or 2 days if the stage has no rules).
 */
export function suggestNextFollowUp(args: {
  rules: FollowUpRule[];
  stageEnteredAt: Date;
  attempt: number;
  now?: Date;
  tz?: string;
}): Date {
  const { stageEnteredAt, attempt } = args;
  const now = args.now ?? new Date();
  const tz = args.tz ?? DEFAULT_TZ;
  const rules = [...args.rules].sort((a, b) => a.sequence - b.sequence);

  if (rules.length === 0 || attempt >= rules.length) {
    const last = rules.at(-1);
    const prev = rules.at(-2);
    const gapDays = last ? Math.max(1, last.offset_days - (prev?.offset_days ?? 0)) : 2;
    return snapToMorning(addDays(now, gapDays), tz);
  }

  const rule = rules[attempt];
  if (rule.offset_days > 0) {
    const target = snapToMorning(
      addHours(addDays(stageEnteredAt, rule.offset_days), rule.offset_hours),
      tz,
    );
    return target.getTime() > now.getTime() ? target : snapToMorning(addDays(now, 1), tz);
  }
  const target = addHours(stageEnteredAt, rule.offset_hours);
  return target.getTime() > now.getTime() ? target : addHours(now, Math.max(1, rule.offset_hours));
}
