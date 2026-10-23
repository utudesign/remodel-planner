import { NewDealEntry } from "@/components/deals/new-deal-entry";
import { PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";

export const metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ paste?: string; call?: string }> }) {
  const { paste, call } = await searchParams;
  await requireOwner();
  const mode = paste ? "paste" : call ? "call" : "manual";
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={mode === "paste" ? "Paste a message" : mode === "call" ? "Missed call" : "New deal"}
        description="The deal number (like 26-1047) is assigned when you save."
      />
      <NewDealEntry mode={mode} />
    </div>
  );
}
