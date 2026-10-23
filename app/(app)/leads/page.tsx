import { PageHeader } from "@/components/shared/states";
import { LeadBoard } from "@/components/leads/lead-board";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { requirePageRole } from "@/lib/auth/require-role";
import { getBoardLeads } from "@/server/queries/leads";
import { getLostReasons, getStages } from "@/server/queries/settings";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const s = await requirePageRole("admin", "designer");
  const [stages, leads, reasons] = await Promise.all([
    getStages(s),
    getBoardLeads(s),
    getLostReasons(s),
  ]);
  const now = new Date();
  const overdue = leads.filter(
    (l) => l.next_follow_up_at && new Date(l.next_follow_up_at) < now,
  ).length;

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          overdue > 0
            ? `${overdue} follow-up${overdue === 1 ? "" : "s"} overdue. Drag a card to change its stage.`
            : "Drag a card to change its stage. Every open lead has a next follow-up."
        }
        actions={<NewLeadDialog />}
      />
      <LeadBoard
        stages={stages.filter((x) => x.active)}
        leads={leads}
        reasons={reasons.filter((r) => r.active)}
        tz={s.timezone}
        nowIso={now.toISOString()}
      />
    </>
  );
}
