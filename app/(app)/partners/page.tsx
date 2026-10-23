import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { formatCents } from "@/lib/money";
import { getPartnersWithPlans } from "@/server/queries/deals";
import type { PlanRow } from "@/lib/deals/plans";

export const metadata = { title: "Partners" };

function pct(n: number) {
  return `${Math.round(Number(n) * 10000) / 100}%`;
}

export default async function PartnersPage() {
  const s = await requireOwner();
  const partners = await getPartnersWithPlans(s);
  return (
    <>
      <PageHeader title="Partners" description="The contractors you hand deals to, and how each one pays you." />
      {partners.length === 0 ? <EmptyState title="No partners yet" /> : null}
      <div className="flex flex-col gap-4">
        {partners.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>
                {[p.contact_name, p.phone, p.email].filter(Boolean).join(" · ") || "No contact details yet"}
                {p.license_number ? ` · License ${p.license_number}${p.license_class ? ` (Class ${p.license_class})` : ""}` : " · License number missing"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y">
                {(p.plans as PlanRow[]).map((pl) => (
                  <li key={pl.id} className="py-2.5">
                    <p className="font-semibold">{pl.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {pct(pl.rate)} of {pl.basis === "contract_price" ? "contract price" : "gross profit"} ·{" "}
                      {pct(pl.first_payout_pct)} earned at deposit, rest at paid in full
                      {pl.min_cents ? ` · ${formatCents(pl.min_cents)} floor` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
