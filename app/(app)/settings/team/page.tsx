import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberRow } from "@/components/settings/member-row";
import { requirePageRole } from "@/lib/auth/require-role";
import { getTeam } from "@/server/queries/settings";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const s = await requirePageRole("admin");
  const team = (await getTeam(s)).filter((u) => !u.email?.endsWith("@example.com"));
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>
            Admin = everything incl. Settings and closing jobs. Office = sees and edits everything
            except Settings and closing. Field = only projects they&apos;re added to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {team.map((u) => (
              <MemberRow key={u.id} user={u} isSelf={u.id === s.userId} />
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>
            Use the company menu (bottom of the sidebar) → Manage → Members → Invite. New people
            join as Field; set their role here after they sign in.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
