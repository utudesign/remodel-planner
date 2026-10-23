import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

export async function getAllPayments(s: Session) {
  const rows = must(
    await s.db
      .from("payments")
      .select(
        "id, label, amount_cents, due_trigger, due_date, received_on, method, check_number, status, project:projects(id, name, status)",
      )
      .order("due_date", { ascending: true, nullsFirst: false }),
  );
  return rows;
}
