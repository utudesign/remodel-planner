import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/require-role";
import { dealHref, dealRefFor } from "@/server/queries/deal-ref";

/** /job/<project uuid> → the deal jacket (the job is the delivery half of a deal). */
export default async function JobById({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const s = await getSession();
  const d = await dealRefFor(s, { projectId: id });
  if (!d) notFound();
  redirect(dealHref(d, tab ?? "tasks"));
}
