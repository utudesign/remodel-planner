import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/states";
import { InviteForm, PartnerForm, PlanForm } from "@/components/partners/partner-forms";
import { requireOwner } from "@/lib/auth/require-role";
import { formatDateTime } from "@/lib/dates";
import { must } from "@/server/action-utils";
import { getPartnersWithPlans } from "@/server/queries/deals";
import type { PlanRow } from "@/lib/deals/plans";

export const metadata = { title: "Partners" };

export default async function PartnersPage() {
  const s = await requireOwner();
  const [partners, invites, logins] = await Promise.all([
    getPartnersWithPlans(s),
    s.db.from("partner_invites").select("partner_id, email, name, invited_at, accepted_at").eq("company_id", s.companyId).then(must),
    s.db.from("users").select("partner_id, name, email").eq("company_id", s.companyId).eq("role", "partner").eq("active", true).then(must),
  ]);
  return (
    <>
      <PageHeader title="Partners" description="The contractors you hand deals to, and how each one pays you." />
      <div className="flex flex-col gap-5">
        {partners.map((p) => {
          const login = logins.find((l) => l.partner_id === p.id);
          const invite = invites.find((i) => i.partner_id === p.id && !i.accepted_at);
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                {!p.license_number ? (
                  <CardDescription className="text-destructive">License number missing: clients see it on your estimates.</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <PartnerForm p={p} />
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Commission plans</h3>
                  <p className="text-xs text-muted-foreground">
                    The seeded plans are placeholders. Match them to your signed agreement.
                  </p>
                  {(p.plans as PlanRow[]).map((pl) => (
                    <PlanForm key={pl.id} partnerId={p.id} plan={pl} />
                  ))}
                  <details>
                    <summary className="flex h-11 cursor-pointer items-center text-sm font-semibold text-primary">+ Add a plan</summary>
                    <PlanForm partnerId={p.id} />
                  </details>
                </section>
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Partner login (optional)</h3>
                  {login ? (
                    <p className="text-sm">
                      {login.name ?? login.email} can log in. She sees only deals handed to {p.name} and updates job progress.
                    </p>
                  ) : (
                    <>
                      {invite ? (
                        <p className="text-sm text-muted-foreground">
                          Invited {invite.email} on {formatDateTime(invite.invited_at, s.timezone)}. Not signed in yet.
                        </p>
                      ) : null}
                      <InviteForm partnerId={p.id} email={p.email} name={p.contact_name} />
                    </>
                  )}
                </section>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardHeader>
            <CardTitle>Another partner</CardTitle>
          </CardHeader>
          <CardContent>
            <PartnerForm p={{ name: "", contact_name: null, phone: null, email: null, license_number: null, license_class: null }} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
