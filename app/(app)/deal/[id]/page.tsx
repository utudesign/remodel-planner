import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/require-role";
import { dealHref, dealRefFor } from "@/server/queries/deal-ref";

/** /deal/<uuid> → /deals/<year>/<number> (links from notifications and the activity feed). */
export default async function DealById({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const s = await getSession();
  const d = await dealRefFor(s, { dealId: id });
  if (!d) notFound();
  redirect(dealHref(d, tab));
}
