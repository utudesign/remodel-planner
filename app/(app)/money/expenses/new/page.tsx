import { ExpenseForm } from "@/components/money/forms";
import { PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { listDeals } from "@/server/queries/deals";

export const metadata = { title: "Add expense" };

export default async function NewExpense() {
  const s = await requireOwner();
  const deals = await listDeals(s);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Add expense" description="Business only: kept apart from your day job." />
      <ExpenseForm
        today={todayIn(s.timezone)}
        deals={deals.slice(0, 60).map((d) => ({ id: d.id, label: `#${d.deal_number} ${d.contact?.name ?? d.title ?? ""}` }))}
      />
    </div>
  );
}
