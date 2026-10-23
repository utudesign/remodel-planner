import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

export async function getStages(s: Session) {
  return must(
    await s.db
      .from("pipeline_stages")
      .select("id, key, label, sort_order, active")
      .order("sort_order"),
  );
}

export async function getLostReasons(s: Session) {
  return must(
    await s.db
      .from("lost_reasons")
      .select("id, key, label, active, sort_order")
      .order("sort_order"),
  );
}

export async function getFollowUpRules(s: Session, stageId: string) {
  return must(
    await s.db
      .from("follow_up_rules")
      .select("sequence, offset_days, offset_hours, description")
      .eq("stage_id", stageId)
      .order("sequence"),
  );
}

export async function getTeam(s: Session) {
  return must(
    await s.db
      .from("users")
      .select("id, name, email, phone, role, active, is_default_owner")
      .order("name"),
  );
}

export async function getPaymentTemplates(s: Session) {
  return must(
    await s.db
      .from("payment_templates")
      .select(
        "id, name, sort_order, active, items:payment_template_items(id, label, kind, percent_bps, amount_cents, due_trigger, sort_order)",
      )
      .order("sort_order"),
  );
}

export async function getTaskTemplates(s: Session) {
  return must(
    await s.db
      .from("task_templates")
      .select(
        "id, name, is_default, active, items:task_template_items(id, title, milestone_key, kind, sort_order)",
      )
      .order("name"),
  );
}

export async function getMilestoneDefinitions(s: Session) {
  return must(
    await s.db.from("milestone_definitions").select("key, label, sort_order").order("sort_order"),
  );
}

export async function getCostCategories(s: Session) {
  return must(
    await s.db
      .from("cost_categories")
      .select("id, key, label, active, sort_order")
      .order("sort_order"),
  );
}
