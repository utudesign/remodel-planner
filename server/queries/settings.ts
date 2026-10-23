import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

export async function getStageRows(s: Session) {
  return must(
    await s.db
      .from("pipeline_stages")
      .select("id, key, label, kind, sort_order, active")
      .eq("company_id", s.companyId)
      .order("sort_order"),
  );
}

export async function getLostReasonRows(s: Session) {
  return must(
    await s.db
      .from("lost_reasons")
      .select("id, key, label, active, sort_order")
      .eq("company_id", s.companyId)
      .order("sort_order"),
  );
}

export async function getFollowUpRules(s: Session) {
  return must(
    await s.db
      .from("follow_up_rules")
      .select("stage_key, sequence, offset_days, offset_hours, description")
      .eq("company_id", s.companyId)
      .order("sequence"),
  );
}
