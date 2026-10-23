import { EmptyState, PageHeader } from "@/components/shared/states";

export const metadata = { title: "Leads" };

export default function Page() {
  return (
    <>
      <PageHeader title="Leads" />
      <EmptyState title="Coming in a later step" />
    </>
  );
}
