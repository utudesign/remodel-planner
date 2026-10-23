import { PageHeader } from "@/components/shared/states";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { requirePageRole } from "@/lib/auth/require-role";

export const metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ paste?: string }> }) {
  const { paste } = await searchParams;
  await requirePageRole("owner", "team");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New deal" description="The deal number is assigned when you save." />
      <NewLeadForm paste={paste === "1"} />
    </div>
  );
}
