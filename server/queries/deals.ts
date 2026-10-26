import type { Session } from "@/lib/auth/require-role";
import { must, maybe } from "@/server/action-utils";

export const DEAL_LIST_SELECT =
  "id, deal_number, deal_year, title, stage, scope, source, created_at, opened_on, first_response_at, " +
  "next_follow_up_at, last_touch_at, estimated_value_cents, sold_price_cents, change_orders_cents, " +
  "handed_off_at, job_status, deposit_received_at, paid_in_full_at, cancelled_at, partner_updated_at, " +
  "lost_reason, partner_id, commission_plan_id, owner_id, origin, contact:contacts(name, phone, address, city)";

export type Stage = { key: string; label: string; kind: "open" | "handed_off" | "lost"; sort_order: number; active: boolean };

export type DealRow = {
  id: string;
  deal_number: string;
  deal_year: number;
  title: string | null;
  stage: string;
  scope: string | null;
  source: string | null;
  created_at: string | null;
  opened_on: string | null;
  first_response_at: string | null;
  next_follow_up_at: string | null;
  last_touch_at: string | null;
  estimated_value_cents: number | null;
  sold_price_cents: number | null;
  change_orders_cents: number;
  handed_off_at: string | null;
  job_status: string;
  deposit_received_at: string | null;
  paid_in_full_at: string | null;
  cancelled_at: string | null;
  partner_updated_at: string | null;
  lost_reason: string | null;
  partner_id: string | null;
  commission_plan_id: string | null;
  owner_id: string | null;
  /** "rep" = mine; "partner" = RenoDesign's own deal, created by Crystal (0013) */
  origin: string;
  contact: { name: string | null; phone: string | null; address: string | null; city: string | null } | null;
};

export type CommissionRow = {
  deal_id: string;
  expected_cents: number;
  earned_cents: number;
  paid_cents: number;
  owed_cents: number;
  commission_status: string;
  plan_name: string;
  partner_name: string;
  deposit_received_at: string | null;
  last_paid_on: string | null;
};

export async function getStages(s: Session): Promise<Stage[]> {
  const rows = must(
    await s.db
      .from("pipeline_stages")
      .select("key, label, kind, sort_order, active")
      .eq("company_id", s.companyId)
      .order("sort_order"),
  );
  return rows as Stage[];
}

export async function getLostReasons(s: Session) {
  return must(
    await s.db
      .from("lost_reasons")
      .select("key, label, active, sort_order")
      .eq("company_id", s.companyId)
      .order("sort_order"),
  );
}

export async function listDeals(s: Session): Promise<DealRow[]> {
  const rows = must(
    await s.db
      .from("deals")
      .select(DEAL_LIST_SELECT)
      .eq("company_id", s.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
  );
  return rows as unknown as DealRow[];
}

export async function getCommissions(s: Session): Promise<Map<string, CommissionRow>> {
  const rows = must(
    await s.db
      .from("deal_commissions")
      .select(
        "deal_id, expected_cents, earned_cents, paid_cents, owed_cents, commission_status, plan_name, partner_name, deposit_received_at, last_paid_on",
      )
      .eq("company_id", s.companyId),
  );
  return new Map((rows as unknown as CommissionRow[]).map((r) => [r.deal_id, r]));
}

export type DealDetail = DealRow & {
  company_id: string;
  contact_id: string | null;
  notes: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  timeline: string | null;
  decision_maker: string | null;
  owns_home: boolean | null;
  knowledge_level: number | null;
  year_built: number | null;
  stage_entered_at: string;
  partner_note: string | null;
  partner_gross_profit_cents: number | null;
  job_completed_at: string | null;
  booking_token: string;
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    zip: string | null;
  } | null;
};

export async function getDealByNumber(s: Session, number: string): Promise<DealDetail | null> {
  const row = maybe(
    await s.db
      .from("deals")
      .select(
        DEAL_LIST_SELECT.replace(
          "contact:contacts(name, phone, address, city)",
          "company_id, contact_id, notes, budget_min_cents, budget_max_cents, timeline, decision_maker, owns_home, " +
            "knowledge_level, year_built, stage_entered_at, partner_note, partner_gross_profit_cents, job_completed_at, booking_token, " +
            "contact:contacts(name, phone, email, address, city, zip)",
        ),
      )
      .eq("company_id", s.companyId)
      .eq("deal_number", number)
      .is("deleted_at", null)
      .maybeSingle(),
  );
  return row as unknown as DealDetail | null;
}

export type ChecklistItem = {
  requirement_id: string;
  gate: string;
  folder: string;
  label: string;
  required: boolean;
  sort_order: number;
  file_count: number;
  satisfied: boolean;
};

export async function getChecklist(s: Session, dealId: string, gate?: string): Promise<ChecklistItem[]> {
  let q = s.db
    .from("deal_jacket_checklist")
    .select("requirement_id, gate, folder, label, required, sort_order, file_count, satisfied")
    .eq("deal_id", dealId);
  if (gate) q = q.eq("gate", gate);
  const rows = must(await q.order("sort_order"));
  return rows as unknown as ChecklistItem[];
}

export type DealFile = {
  id: string;
  folder: string;
  photo_tag: string | null;
  title: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  taken_at: string | null;
  created_at: string;
  requirement_id: string | null;
};

export async function getDealFiles(s: Session, dealId: string): Promise<DealFile[]> {
  const rows = must(
    await s.db
      .from("deal_files")
      .select("id, folder, photo_tag, title, storage_path, mime_type, size_bytes, taken_at, created_at, requirement_id")
      .eq("deal_id", dealId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  );
  return rows as DealFile[];
}

export async function getActivities(s: Session, dealId: string) {
  return must(
    await s.db
      .from("activities")
      .select("id, type, direction, summary, occurred_at")
      .eq("deal_id", dealId)
      .order("occurred_at", { ascending: false })
      .limit(100),
  );
}

export async function getMeetings(s: Session, dealId: string) {
  return must(
    await s.db
      .from("meetings")
      .select("id, kind, starts_at, ends_at, status, booked_via, notes")
      .eq("deal_id", dealId)
      .order("starts_at", { ascending: false }),
  );
}

export async function getPartnersWithPlans(s: Session) {
  return must(
    await s.db
      .from("partners")
      .select(
        "id, name, contact_name, phone, email, license_number, license_class, active, plans:commission_plans(id, name, basis, rate, first_payout_pct, min_cents, active)",
      )
      .eq("company_id", s.companyId)
      .order("name"),
  );
}

/** Settings → Texts, in sequence order. */
export async function getTextTemplates(s: Session) {
  return must(
    await s.db
      .from("text_templates")
      .select("key, label, body, stage_key, after_days, sort_order, active")
      .eq("company_id", s.companyId)
      .order("sort_order"),
  );
}

/** Template keys sent on this deal since a moment (the stage start). */
export async function getTextSends(s: Session, dealId: string, since: string) {
  const rows = must(
    await s.db
      .from("text_sends")
      .select("template_key, sent_at")
      .eq("deal_id", dealId)
      .gte("sent_at", since)
      .order("sent_at", { ascending: false }),
  );
  return rows;
}

/** The newest estimate I shared with the client (has a document number), for {link}. */
export async function getSharedQuoteToken(s: Session, dealId: string): Promise<string | null> {
  const { data } = await s.db
    .from("quotes")
    .select("client_token, sent_at")
    .eq("deal_id", dealId)
    .not("doc_number", "is", null)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data?.client_token ?? null;
}

/** The client's answers from the free-estimate form, if the deal came from it. */
export async function getIntake(s: Session, dealId: string) {
  const { data } = await s.db
    .from("deal_intake")
    .select("summary, ballpark_low_cents, ballpark_high_cents, created_at")
    .eq("deal_id", dealId)
    .maybeSingle();
  return data;
}
