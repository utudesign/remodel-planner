import { EmptyState, PageHeader } from "@/components/shared/states";

export const metadata = { title: "Payments" };

export default function Page() {
  return (
    <>
      <PageHeader title="Payments" />
      <EmptyState title="Coming in a later step" />
    </>
  );
}
