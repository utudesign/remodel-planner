import type { DealFolder } from "@/lib/deals/dealNumber";

/** Labels for values stored as stable keys. (Stages and lost reasons come from the database.) */
export const SCOPES = [
  { key: "kitchen", label: "Kitchen", tone: "bg-[#efe9dc] text-[#5e4a1e]" },
  { key: "cabinets_only", label: "Cabinets only", tone: "bg-[#e3ecf4] text-[#234a6b]" },
  { key: "countertops", label: "Countertops", tone: "bg-[#ece6f2] text-[#4a3566]" },
  { key: "bath", label: "Bath", tone: "bg-[#e3f0ef] text-[#1f5550]" },
  { key: "other", label: "Other", tone: "bg-muted text-muted-foreground" },
] as const;
export type Scope = (typeof SCOPES)[number]["key"];
export const SCOPE_KEYS = SCOPES.map((s) => s.key) as [Scope, ...Scope[]];

export function scopeInfo(key: string | null | undefined) {
  return SCOPES.find((s) => s.key === key) ?? null;
}

export const SOURCES = [
  { key: "marketplace", label: "FB Marketplace" },
  { key: "fb_group", label: "FB group" },
  { key: "referral", label: "Referral" },
  { key: "call", label: "Phone call" },
  { key: "share_link", label: "Share link" },
  { key: "google", label: "Google" },
  { key: "nextdoor", label: "Nextdoor" },
  { key: "walk_in", label: "Showroom / walk-in" },
  { key: "other", label: "Other" },
] as const;
export type Source = (typeof SOURCES)[number]["key"];
export const SOURCE_KEYS = SOURCES.map((s) => s.key) as [Source, ...Source[]];

export function sourceLabel(key: string | null | undefined) {
  return SOURCES.find((s) => s.key === key)?.label ?? key ?? "Unknown";
}

export const TIMELINES = [
  { key: "asap", label: "As soon as possible" },
  { key: "1_3_months", label: "1–3 months" },
  { key: "3_6_months", label: "3–6 months" },
  { key: "later", label: "Later / just looking" },
] as const;
export const TIMELINE_KEYS = TIMELINES.map((t) => t.key) as [string, ...string[]];
export function timelineLabel(key: string | null | undefined) {
  return TIMELINES.find((t) => t.key === key)?.label ?? null;
}

export const KNOWLEDGE = [
  { value: 1, label: "Just starting to look" },
  { value: 2, label: "Has ideas, needs guidance" },
  { value: 3, label: "Knows exactly what they want" },
] as const;

/** Job status of a sold deal (0006 deals.job_status). */
export const JOB_STATUSES = [
  { key: "not_started", label: "Not signed yet" },
  { key: "signed", label: "Contract signed" },
  { key: "ordered", label: "Ordered" },
  { key: "in_progress", label: "Installing" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number]["key"];
export function jobStatusLabel(key: string | null | undefined) {
  return JOB_STATUSES.find((j) => j.key === key)?.label ?? "—";
}

export const FOLDER_LABELS: Record<DealFolder, string> = {
  photos: "Photos",
  estimates: "Estimates",
  design: "Design + measurements",
  contract: "Contract",
  permits: "Permits",
  invoices_receipts: "Invoices + receipts",
  payments: "Payments",
  change_orders: "Change orders",
  warranty: "Warranty",
  other: "Other",
};

export const PHOTO_TAGS = [
  { key: "before", label: "Before" },
  { key: "measurement", label: "Measurement" },
  { key: "sketch", label: "Sketch" },
  { key: "appliance_label", label: "Appliance label" },
  { key: "under_sink", label: "Under sink" },
  { key: "panel", label: "Panel" },
  { key: "progress", label: "Progress" },
  { key: "issue", label: "Issue" },
  { key: "after", label: "After" },
  { key: "other", label: "Other" },
] as const;
export const PHOTO_TAG_KEYS = PHOTO_TAGS.map((t) => t.key) as [string, ...string[]];

export const COMMISSION_STATUS_TONE: Record<string, string> = {
  owed: "bg-destructive text-white",
  "part paid": "bg-warning/20 text-foreground",
  paid: "bg-accent text-accent-foreground",
  pending: "bg-muted text-muted-foreground",
  "waiting for price": "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/** "Lee" from "Grace Lee" (for file names and short labels). */
export function lastName(full: string | null | undefined) {
  const parts = (full ?? "").trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : "";
}
