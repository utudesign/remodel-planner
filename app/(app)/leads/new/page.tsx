import { PageHeader } from "@/components/shared/states";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { requirePageRole } from "@/lib/auth/require-role";

export const metadata = { title: "New lead" };

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ paste?: string }>;
}) {
  const { paste } = await searchParams;
  await requirePageRole("owner", "team");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New lead" />
      <NewLeadForm paste={paste === "1"} />
    </div>
  );
}
