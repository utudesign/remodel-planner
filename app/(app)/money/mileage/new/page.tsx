import { TripForm } from "@/components/money/forms";
import { PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { listDeals } from "@/server/queries/deals";

export const metadata = { title: "Log trip" };

export default async function NewTrip({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const { deal } = await searchParams;
  const s = await requireOwner();
  const deals = await listDeals(s);
  const d = deals.find((x) => x.deal_number === deal);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Log a trip" description={`Deducted at ${s.settings.mileageRateCents}¢ a mile (Settings).`} />
      <TripForm
        today={todayIn(s.timezone)}
        dealId={d?.id}
        purpose={d ? `Site visit — ${d.contact?.name ?? d.title ?? `#${d.deal_number}`}` : undefined}
        deals={deals.slice(0, 60).map((x) => ({ id: x.id, label: `#${x.deal_number} ${x.contact?.name ?? x.title ?? ""}` }))}
      />
    </div>
  );
}
