import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ, localToUtc } from "@/lib/dates";

/** A row of text_templates (Settings → Texts). */
export type TextTemplate = {
  key: string;
  label: string;
  body: string;
  stage_key: string | null;
  after_days: number | null;
  sort_order: number;
  active: boolean;
};

export type TextVars = {
  first: string;
  me: string;
  brand: string;
  partner_contact: string;
  when: string;
  link: string;
  booking: string;
};

export const TEXT_VARS: { key: keyof TextVars; hint: string }[] = [
  { key: "first", hint: "client's first name" },
  { key: "me", hint: "your first name" },
  { key: "brand", hint: "partner company (RenoDesign)" },
  { key: "partner_contact", hint: "partner's contact (Crystal)" },
  { key: "when", hint: "next visit, e.g. tomorrow at 6:30 PM" },
  { key: "link", hint: "client estimate link (after you share one)" },
  { key: "booking", hint: "the client's booking link" },
];

export const NO_LINK = "[share the estimate first]";

const firstWord = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] ?? "";

/** "RenoDesign Inc." → "RenoDesign" */
export function brandName(partnerName: string | null | undefined): string {
  const n = (partnerName ?? "").trim().replace(/[,\s]+(inc\.?|llc\.?|l\.l\.c\.|co\.?|corp\.?|corporation|ltd\.?)$/i, "");
  return n || "RenoDesign";
}

/** "today at 6:30 PM", "tomorrow at 9:00 AM", "Thu, Oct 29 at 6:30 PM" */
export function visitWhen(startsAt: string | Date | null | undefined, tz = DEFAULT_TZ, now = new Date()): string {
  if (!startsAt) return "soon";
  const at = new Date(startsAt);
  const day = (d: Date) => formatInTimeZone(d, tz, "yyyy-MM-dd");
  const time = formatInTimeZone(at, tz, "h:mm a");
  if (day(at) === day(now)) return `today at ${time}`;
  if (day(at) === day(addDays(now, 1))) return `tomorrow at ${time}`;
  return `${formatInTimeZone(at, tz, "EEE, MMM d")} at ${time}`;
}

export function buildTextVars(v: {
  customerName: string | null | undefined;
  myName: string | null | undefined;
  partnerName: string | null | undefined;
  partnerContact: string | null | undefined;
  nextVisitAt: string | Date | null | undefined;
  estimateLink: string | null | undefined;
  bookingLink: string;
  tz?: string;
  now?: Date;
}): TextVars {
  return {
    first: firstWord(v.customerName) || "there",
    me: firstWord(v.myName) || "your kitchen guy",
    brand: brandName(v.partnerName),
    partner_contact: firstWord(v.partnerContact) || "Our project manager",
    when: visitWhen(v.nextVisitAt, v.tz, v.now),
    link: v.estimateLink || NO_LINK,
    booking: v.bookingLink,
  };
}

export function fillText(body: string, vars: TextVars): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k as keyof TextVars] : m)).trim();
}

/** Day-based steps are due at 9:00 AM local, counted from when the deal entered the stage. */
export function dueAt(stageEnteredAt: Date, afterDays: number, tz = DEFAULT_TZ): Date {
  if (afterDays === 0) return stageEnteredAt;
  return localToUtc(formatInTimeZone(addDays(stageEnteredAt, afterDays), tz, "yyyy-MM-dd"), "09:00", tz);
}

export type Suggestion = {
  /** The template to show first (the next unsent step for this stage), or null if the stage has none left. */
  current: TextTemplate | null;
  /** True when current's day hasn't come yet. */
  early: boolean;
  dueAt: Date | null;
  /** The step after current (for the follow-up date after sending current). */
  next: TextTemplate | null;
};

/** The stage's automatic steps (after_days set), in order. */
export function stageSteps(templates: TextTemplate[], stage: string): TextTemplate[] {
  return templates
    .filter((t) => t.active && t.stage_key === stage && t.after_days !== null)
    .sort((a, b) => (a.after_days! - b.after_days!) || a.sort_order - b.sort_order);
}

/**
 * Next text for a deal: the first step of its stage not sent since it entered the stage.
 * Steps whose day hasn't come are still offered (marked early) so I can send them sooner.
 */
export function suggestText(args: {
  templates: TextTemplate[];
  stage: string;
  stageEnteredAt: Date;
  sentKeysSinceStage: Set<string>;
  now?: Date;
  tz?: string;
}): Suggestion {
  const now = args.now ?? new Date();
  const steps = stageSteps(args.templates, args.stage);
  const i = steps.findIndex((t) => !args.sentKeysSinceStage.has(t.key));
  if (i === -1) return { current: null, early: false, dueAt: null, next: null };
  const current = steps[i];
  const due = dueAt(args.stageEnteredAt, current.after_days!, args.tz);
  return { current, early: due.getTime() > now.getTime(), dueAt: due, next: steps[i + 1] ?? null };
}

/** Ordered list for the picker: this stage's texts first, then any-stage ones, then the rest. */
export function orderForStage(templates: TextTemplate[], stage: string): TextTemplate[] {
  const rank = (t: TextTemplate) => (t.stage_key === stage ? 0 : t.stage_key === null ? 1 : 2);
  return templates.filter((t) => t.active).sort((a, b) => rank(a) - rank(b) || a.sort_order - b.sort_order);
}
