import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { LeadBoard } from "@/components/leads/lead-board";
import { LeadCard } from "@/components/leads/lead-card";
import { requirePageRole } from "@/lib/auth/require-role";
import { getBoardLeads } from "@/server/queries/leads";
import { getLostReasons, getStages } from "@/server/queries/settings";
import { getUnread } from "@/server/queries/team";

export const metadata = { title: "Leads" };

/** Phone: list grouped by stage. Tablet/desktop (≥1024px): drag board. */
export default async function LeadsPage() {
  const s = await requirePageRole("owner", "team");
  const [stages, leads, reasons, unread] = await Promise.all([
    getStages(s),
    getBoardLeads(s),
    getLostReasons(s),
    getUnread(s),
  ]);
  const now = new Date();
  const overdue = leads.filter((l) => {
    const st = stages.find((x) => x.id === l.stage_id)?.key;
    return (
      st !== "won" && st !== "lost" && (!l.next_follow_up_at || new Date(l.next_follow_up_at) < now)
    );
  }).length;
  const open = stages.filter((x) => x.active && x.key !== "won" && x.key !== "lost");
  const unreadIds = [...unread.leads];

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          overdue > 0
            ? `${overdue} follow-up${overdue === 1 ? "" : "s"} overdue.`
            : "Every open lead has a next follow-up."
        }
        actions={
          <Link
            href="/leads/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> New lead
          </Link>
        }
      />

      <div className="flex flex-col gap-5 lg:hidden">
        {open.map((st) => {
          const items = leads.filter((l) => l.stage_id === st.id);
          return (
            <section key={st.id}>
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                {st.label}{" "}
                <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
              </h2>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      tz={s.timezone}
                      now={now}
                      lost={false}
                      unread={unread.leads.has(l.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {leads.length === 0 ? (
          <EmptyState title="No leads yet" description="Tap + → New lead or Paste a message." />
        ) : null}
      </div>

      <div className="hidden lg:block">
        <LeadBoard
          stages={stages.filter((x) => x.active)}
          leads={leads}
          reasons={reasons.filter((r) => r.active)}
          tz={s.timezone}
          nowIso={now.toISOString()}
          unread={unreadIds}
        />
      </div>
    </>
  );
}
