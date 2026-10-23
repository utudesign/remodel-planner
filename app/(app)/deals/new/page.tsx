import { NewDealForm } from "@/components/deals/new-deal-form";
import { PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";

export const metadata = { title: "New deal" };

export default async function NewDealPage() {
  await requireOwner();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New deal" description="The deal number (like 26-1047) is assigned when you save." />
      <NewDealForm />
    </div>
  );
}
