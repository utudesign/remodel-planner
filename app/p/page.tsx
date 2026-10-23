import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ScopeBadge } from "@/components/deals/deal-card";
import { getSession } from "@/lib/auth/require-role";
import { jobStatusLabel } from "@/lib/deals/display";
import { formatCentsWhole } from "@/lib/money";
import { must } from "@/server/action-utils";

export const metadata = { title: "My jobs" };

export default async function PartnerHome() {
  const s = await getSession();
  const deals = must(
    await s.db
      .from("deals")
      .select("id, deal_number, scope, job_status, sold_price_cents, handed_off_at, contact:contacts(name, city)")
      .not("handed_off_at", "is", null)
      .order("handed_off_at", { ascending: false }),
  );
  return (
    <>
      <PageHeader title={`Hi ${s.name.split(" ")[0] || "there"}`} description="Deals handed to you. Tap one to update the job." />
      {deals.length === 0 ? (
        <EmptyState title="No deals yet" description="They show up here the moment they're handed to you." />
      ) : (
        <ul className="flex flex-col gap-2">
          {deals.map((d) => (
            <li key={d.id}>
              <Link href={`/p/${d.deal_number}`} className="block rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">#{d.deal_number}</span>
                  {d.sold_price_cents ? <span className="font-bold tabular-nums">{formatCentsWhole(d.sold_price_cents)}</span> : null}
                </div>
                <p className="mt-0.5 font-semibold">
                  {d.contact?.name ?? "Customer"} {d.contact?.city ? `· ${d.contact.city}` : ""}
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <ScopeBadge scope={d.scope} /> {jobStatusLabel(d.job_status)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
