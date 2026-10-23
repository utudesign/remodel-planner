import { EmptyState, PageHeader } from "@/components/shared/states";

export const metadata = { title: "Projects" };

export default function Page() {
  return (
    <>
      <PageHeader title="Projects" />
      <EmptyState title="Coming in a later step" />
    </>
  );
}
