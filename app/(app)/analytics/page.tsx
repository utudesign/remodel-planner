import { EmptyState, PageHeader } from "@/components/shared/states";

export const metadata = { title: "Analytics" };

export default function Page() {
  return (
    <>
      <PageHeader title="Analytics" />
      <EmptyState title="Coming in a later step" />
    </>
  );
}
