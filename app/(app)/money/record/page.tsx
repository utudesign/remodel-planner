import { notFound } from "next/navigation";
import { PaymentForm } from "@/components/money/forms";
import { PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { centsToInput, formatCents } from "@/lib/money";
import { maybe } from "@/server/action-utils";

export const metadata = { title: "Record commission" };

export default async function RecordPayment({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const { deal } = await searchParams;
  const s = await requireOwner();
  if (!deal) notFound();
  const c = maybe(
    await s.db
      .from("deal_commissions")
      .select("deal_id, deal_number, partner_name, plan_name, expected_cents, earned_cents, paid_cents, owed_cents")
      .eq("company_id", s.companyId)
      .eq("deal_number", deal)
      .maybeSingle(),
  );
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={`Commission #${c.deal_number}`}
        description={`${c.partner_name} · ${c.plan_name} · earned ${formatCents(c.earned_cents)}, paid ${formatCents(c.paid_cents)}, owed ${formatCents(c.owed_cents)}`}
      />
      <PaymentForm dealId={c.deal_id!} owedDollars={c.owed_cents && c.owed_cents > 0 ? centsToInput(c.owed_cents) : ""} today={todayIn(s.timezone)} />
    </div>
  );
}
