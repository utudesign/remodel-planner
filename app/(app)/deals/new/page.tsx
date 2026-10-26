import { NewDealEntry } from "@/components/deals/new-deal-entry";
import { PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { getStages } from "@/server/queries/deals";

export const metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ paste?: string; call?: string }> }) {
  const { paste, call } = await searchParams;
  const s = await requireOwner();
  // Where a deal can start: open stages up to the estimate (hand-off has its own checklist).
  const stages = (await getStages(s))
    .filter((x) => x.kind === "open" && x.active && x.key !== "ready")
    .map((x) => ({ key: x.key, label: x.label }));
  const mode = paste ? "paste" : call ? "call" : "manual";
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={mode === "paste" ? "Paste a message" : mode === "call" ? "Missed call" : "New deal"}
        description="The deal number (like 26-1047) is assigned when you save."
      />
      <NewDealEntry mode={mode} stages={stages} />
    </div>
  );
}
