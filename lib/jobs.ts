/**
 * Jobs (0013): milestone keys that mean something to the deal, and the job's money.
 * Milestones live in job_milestone_templates (config); these keys are the stable ones the
 * app links to deal fields. A renamed milestone keeps working; a new one is just a date.
 */
export const JOB_STATUS_ORDER = ["not_started", "signed", "ordered", "in_progress", "completed"] as const;

/** Only ever move the job status forward (never back, never out of "cancelled"). */
export function advanceJobStatus(current: string, to: (typeof JOB_STATUS_ORDER)[number]): string {
  if (current === "cancelled") return current;
  const a = JOB_STATUS_ORDER.indexOf(current as (typeof JOB_STATUS_ORDER)[number]);
  const b = JOB_STATUS_ORDER.indexOf(to);
  return b > a ? to : current;
}

type DealJob = {
  job_status: string;
  deposit_received_at: string | null;
  paid_in_full_at: string | null;
  job_completed_at: string | null;
};

/** What ticking a milestone changes on the deal (empty = nothing). `at` = the day it happened. */
export type DealJobPatch = Partial<{
  job_status: string;
  deposit_received_at: string;
  paid_in_full_at: string;
  job_completed_at: string;
}>;

export function milestoneDealPatch(key: string, d: DealJob, at: string): DealJobPatch {
  const patch: DealJobPatch = {};
  const status = (to: (typeof JOB_STATUS_ORDER)[number]) => {
    const next = advanceJobStatus(d.job_status, to);
    if (next !== d.job_status) patch.job_status = next;
  };
  switch (key) {
    case "contract_signed":
      status("signed");
      break;
    case "deposit":
      status("signed");
      if (!d.deposit_received_at) patch.deposit_received_at = at;
      break;
    case "cabinets_ordered":
      status("ordered");
      break;
    case "demo":
    case "cabinet_install":
      status("in_progress");
      break;
    case "walkthrough":
      status("completed");
      if (!d.job_completed_at) patch.job_completed_at = at;
      break;
    case "paid_full":
      if (!d.paid_in_full_at) patch.paid_in_full_at = at;
      break;
  }
  return patch;
}

export type JobMoney = {
  revenueCents: number;
  costCents: number;
  commissionCents: number;
  profitCents: number;
  /** profit ÷ revenue, null without revenue */
  margin: number | null;
};

/** RenoDesign's side: revenue = sold + change orders; profit = revenue − job costs − Tugu's commission. */
export function jobMoney(v: { soldCents: number | null; changeOrdersCents: number; costs: (number | null)[]; commissionCents: number | null }): JobMoney {
  const revenueCents = (v.soldCents ?? 0) + (v.changeOrdersCents ?? 0);
  const costCents = v.costs.reduce<number>((n, c) => n + (c ?? 0), 0);
  const commissionCents = v.commissionCents ?? 0;
  const profitCents = revenueCents - costCents - commissionCents;
  return { revenueCents, costCents, commissionCents, profitCents, margin: revenueCents > 0 ? profitCents / revenueCents : null };
}
