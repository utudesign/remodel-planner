import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import {
  CancelInviteButton,
  GiveWorkspaceForm,
  InviteTeammateForm,
  MoveToWorkspaceForm,
  RenameWorkspaceForm,
  TeammateButton,
} from "@/components/team/team-forms";
import { requireWsAdmin } from "@/lib/auth/require-role";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/dates";
import { must } from "@/server/action-utils";

export const metadata = { title: "Team" };

/**
 * Who can sign in to this workspace (0016). The owner and each workspace admin (Crystal) manage
 * their own people; the owner also gives a teammate her own workspace.
 */
export default async function TeamPage() {
  const s = await requireWsAdmin();
  const isOwner = s.role === "owner";
  const [people, invites, workspaces] = await Promise.all([
    s.db
      .from("users")
      .select("id, name, email, role, active, workspace_id, workspace_admin")
      .eq("company_id", s.companyId)
      .order("created_at")
      .then(must),
    s.db
      .from("team_invites")
      .select("id, email, name, invited_at")
      .eq("company_id", s.companyId)
      .eq("workspace_id", s.workspaceId)
      .is("accepted_at", null)
      .order("invited_at")
      .then(must),
    s.db.from("workspaces").select("id, name").eq("company_id", s.companyId).order("created_at").then(must),
  ]);
  const mine = people.filter((p) => p.role !== "crew" && p.workspace_id === s.workspaceId);
  const others = workspaces.filter((w) => w.id !== s.workspaceId);
  const movable = isOwner ? mine.filter((p) => p.role !== "owner" && p.active) : [];
  return (
    <>
      <PageHeader
        title="Team"
        description={`Everyone in ${s.workspaceName} works its deals, estimates and jobs. Other workspaces only see a deal you share.`}
      />
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Can sign in to {s.workspaceName}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {mine.map((p) => (
                <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-border/60 py-2 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className={p.active ? "block font-semibold" : "block font-semibold text-muted-foreground line-through"}>
                      {p.name || p.email || "No name"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.role === "owner"
                        ? "Owner · Settings + Team"
                        : p.workspace_admin
                          ? "Workspace admin"
                          : isRole(p.role)
                            ? ROLE_LABELS[p.role]
                            : p.role}
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
            <CardDescription>
              They get an email. When they sign in with that email, they land on Today in {s.workspaceName}.
            </CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>
              Each workspace has its own deals. Share a deal from its Overview tab; the other workspace can then see and edit it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RenameWorkspaceForm name={s.workspaceName} />
            {others.length ? (
              <ul className="flex flex-col">
                {others.map((w) => {
                  const admin = people.find((p) => p.workspace_id === w.id && p.workspace_admin);
                  return (
                    <li key={w.id} className="flex min-h-12 flex-col justify-center border-b border-border/60 py-1.5 last:border-0">
                      <span className="font-medium">{w.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {admin ? `Run by ${admin.name || admin.email}` : "No admin yet"} · private to them
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {movable.map((p) => (
              <details key={p.id} className="group rounded-xl border border-border/60">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
                  {p.name || p.email}: own workspace or move
                </summary>
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <GiveWorkspaceForm userId={p.id} defaultName={(p.name ?? "").split(/\s+/)[0] || "New workspace"} />
                  {others.length ? <MoveToWorkspaceForm userId={p.id} workspaces={others} /> : null}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
