import { EmptyState, PageHeader } from "@/components/shared/states";

export const metadata = { title: "Today" };

export default function Page() {
  return (
    <>
      <PageHeader title="Today" />
      <EmptyState title="Coming in a later step" />
    </>
  );
}
