import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ, localToUtc } from "@/lib/dates";

/**
 * Work windows are stored as ET wall-clock times (FIELD-AND-OFFICE §2). Manila has no DST, so the
 * admin's local hours shift on Nov 1 / mid-March; anchoring in ET keeps coverage stable for clients.
 */
export type WorkWindow = {
  user_id: string;
  weekday: number; // 0 = Sunday … 6 = Saturday (in ET)
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string; // may be earlier than start: runs past midnight
  kind: "live" | "back_office" | "field" | string;
};

export type Member = { id: string; role: string; active: boolean; is_default_owner: boolean };

export type CompanyRules = {
  quietStart: string; // "21:00"
  quietEnd: string; // "08:00"
  responseMinutes: number; // 60
};

export const DEFAULT_RULES: CompanyRules = { quietStart: "21:00", quietEnd: "08:00", responseMinutes: 60 };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

function localParts(at: Date, tz: string) {
  const weekday = Number(formatInTimeZone(at, tz, "i")) % 7; // ISO 1..7 (Mon..Sun) → 0 = Sunday
  const minutes = toMin(formatInTimeZone(at, tz, "HH:mm"));
  return { weekday, minutes };
}

export function isInWindow(w: WorkWindow, at: Date, tz = DEFAULT_TZ): boolean {
  const { weekday, minutes } = localParts(at, tz);
  const start = toMin(w.start_time);
  const end = toMin(w.end_time);
  if (start < end) return weekday === w.weekday && minutes >= start && minutes < end;
  // Overnight: the part after midnight belongs to the window that started the day before.
  return (weekday === w.weekday && minutes >= start) || (weekday === (w.weekday + 1) % 7 && minutes < end);
}

export function usersInWindow(windows: WorkWindow[], at: Date, kind: string, tz = DEFAULT_TZ): string[] {
  return [...new Set(windows.filter((w) => w.kind === kind && isInWindow(w, at, tz)).map((w) => w.user_id))];
}

/**
 * New-lead routing (FIELD-AND-OFFICE §3): whoever is live now gets it (team before owners);
 * otherwise the default owner, flagged "waiting for live shift". The 1-hour clock runs either way.
 */
export function routeNewLead(args: {
  windows: WorkWindow[];
  members: Member[];
  at?: Date;
  tz?: string;
}): { ownerId: string | null; waitingForLive: boolean } {
  const at = args.at ?? new Date();
  const active = args.members.filter((m) => m.active && m.role !== "crew");
  const live = new Set(usersInWindow(args.windows, at, "live", args.tz));
  const pick =
    active.find((m) => live.has(m.id) && m.role === "team") ?? active.find((m) => live.has(m.id));
  if (pick) return { ownerId: pick.id, waitingForLive: false };
  const fallback = active.find((m) => m.is_default_owner) ?? active.find((m) => m.role === "owner") ?? null;
  return { ownerId: fallback?.id ?? null, waitingForLive: true };
}

export function isQuietHours(at: Date, rules: Pick<CompanyRules, "quietStart" | "quietEnd">, tz = DEFAULT_TZ) {
  const { minutes } = localParts(at, tz);
  const s = toMin(rules.quietStart);
  const e = toMin(rules.quietEnd);
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

/**
 * When a client-facing message written now should go out: immediately outside quiet hours,
 * otherwise at the end of quiet hours (default 8:00 AM ET) — DST-safe.
 */
export function nextSendTime(at: Date, rules: Pick<CompanyRules, "quietStart" | "quietEnd">, tz = DEFAULT_TZ): Date {
  if (!isQuietHours(at, rules, tz)) return at;
  const today = formatInTimeZone(at, tz, "yyyy-MM-dd");
  const sameDay = localToUtc(today, rules.quietEnd, tz);
  if (sameDay.getTime() > at.getTime()) return sameDay;
  return localToUtc(formatInTimeZone(addDays(at, 1), tz, "yyyy-MM-dd"), rules.quietEnd, tz);
}

/** Minutes left on the response clock (negative = late). */
export function responseMinutesLeft(createdAt: Date, rules: Pick<CompanyRules, "responseMinutes">, now = new Date()) {
  return Math.round((createdAt.getTime() + rules.responseMinutes * 60_000 - now.getTime()) / 60_000);
}

export function companyRules(settings: Record<string, unknown> | null | undefined): CompanyRules {
  const s = settings ?? {};
  return {
    quietStart: typeof s.quiet_hours_start === "string" ? s.quiet_hours_start : DEFAULT_RULES.quietStart,
    quietEnd: typeof s.quiet_hours_end === "string" ? s.quiet_hours_end : DEFAULT_RULES.quietEnd,
    responseMinutes: typeof s.lead_response_minutes === "number" ? s.lead_response_minutes : DEFAULT_RULES.responseMinutes,
  };
}
