import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { CancelInviteButton, InviteTeammateForm, TeammateButton } from "@/components/team/team-forms";
import { requireOwner } from "@/lib/auth/require-role";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/dates";
import { must } from "@/server/action-utils";

export const metadata = { title: "Team" };

/** Who can sign in (0015). Everyone on the team works every deal; only the owner sees Settings and this page. */
export default async function TeamPage() {
  const s = await requireOwner();
  const [people, invites] = await Promise.all([
    s.db.from("users").select("id, name, email, role, active").eq("company_id", s.companyId).order("created_at").then(must),
    s.db
      .from("team_invites")
      .select("id, email, name, invited_at")
      .eq("company_id", s.companyId)
      .is("accepted_at", null)
      .order("invited_at")
      .then(must),
  ]);
  const signIn = people.filter((p) => p.role !== "crew");
  return (
    <>
      <PageHeader title="Team" description="Everyone here works every deal, estimate and job. Only you see Settings and this page." />
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Can sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {signIn.map((p) => (
                <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-border/60 py-2 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className={p.active ? "block font-semibold" : "block font-semibold text-muted-foreground line-through"}>
                      {p.name || p.email || "No name"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.role === "owner" ? "Owner · Settings + Team" : isRole(p.role) ? ROLE_LABELS[p.role] : p.role}
                      {p.email ? ` · ${p.email}` : ""}
                    </span>
                  </span>
                  {p.role !== "owner" && p.id !== s.userId ? <TeammateButton id={p.id} active={p.active} /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>They get an email. When they sign in with that email, they land on Today with the team&apos;s deals.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <InviteTeammateForm />
            {invites.length ? (
              <ul className="flex flex-col">
                {invites.map((i) => (
                  <li key={i.id} className="flex min-h-12 items-center gap-3 border-b border-border/60 py-1.5 last:border-0">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium">{i.name || i.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Invited {formatDateTime(i.invited_at, s.timezone)} · not signed in yet
                      </span>
                    </span>
                    <CancelInviteButton id={i.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No open invites" />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
