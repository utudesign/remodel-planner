import { EmptyState, PageHeader } from "@/components/shared/states";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" />
      <EmptyState title="Coming in a later step" />
    </>
  );
}
