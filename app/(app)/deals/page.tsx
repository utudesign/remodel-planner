import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { LeadBoard } from "@/components/leads/lead-board";
import { LeadCard } from "@/components/leads/lead-card";
import { ProjectBoard, ProjectCard } from "@/components/projects/project-board";
import { getSession } from "@/lib/auth/require-role";
import { formatDate, todayIn } from "@/lib/dates";
import { dealLabel, formatDealNumber, parseDealNumber } from "@/lib/deals/dealNumber";
import { formatBps } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getBoardLeads } from "@/server/queries/leads";
import { getBoardProjects } from "@/server/queries/projects";
import { getLostReasons, getMilestoneDefinitions, getStages } from "@/server/queries/settings";
import { getUnread } from "@/server/queries/team";

export const metadata = { title: "Deals" };

const SEGMENTS = [
  { key: "sales", label: "In sales" },
  { key: "progress", label: "In progress" },
  { key: "closed", label: "Closed / Lost" },
] as const;

/** Search: #10231, 10231, 2025-10231, or name / phone / address text. */
function matcher(q: string) {
  const n = parseDealNumber(q);
  const text = q.trim().toLowerCase();
  const digits = text.replace(/\D/g, "");
  return (d: { deal_number: string | null; deal_year: number | null; hay: string }) => {
    if (!text) return true;
    if (n) {
      const num = formatDealNumber(n.month, n.day, n.seq);
      return d.deal_number === num && (!n.year || d.deal_year === n.year);
    }
    return d.hay.includes(text) || (digits.length >= 4 && d.hay.replace(/\D/g, "").includes(digits));
  };
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ seg?: string; q?: string }> }) {
  const { seg: segParam, q = "" } = await searchParams;
  const s = await getSession();
  const crew = s.role === "crew";
  const seg = crew ? "progress" : (SEGMENTS.find((x) => x.key === segParam)?.key ?? "sales");
  const now = new Date();
  const today = todayIn(s.timezone);
  const year = Number(today.slice(0, 4));

  const [stages, leads, projects, reasons, defs, unread] = await Promise.all([
    crew ? Promise.resolve([]) : getStages(s),
    crew ? Promise.resolve([]) : getBoardLeads(s),
    getBoardProjects(s),
    crew ? Promise.resolve([]) : getLostReasons(s),
    getMilestoneDefinitions(s),
    getUnread(s),
  ]);
  const match = matcher(q);
  const stageKey = new Map(stages.map((x) => [x.id, x.key]));
  const salesLeads = leads.filter((l) => !["won", "lost"].includes(stageKey.get(l.stage_id) ?? ""));
  const lostLeads = leads.filter((l) => stageKey.get(l.stage_id) === "lost");
  const active = projects.filter((p) => p.status === "active");
  const closed = projects.filter((p) => p.status === "closed");
  const leadHay = (l: (typeof leads)[number]) => ({
    deal_number: l.deal_number,
    deal_year: l.deal_year,
    hay: `${l.name} ${l.phone ?? ""} ${l.address ?? ""}`.toLowerCase(),
  });
  const projHay = (p: (typeof projects)[number]) => ({
    deal_number: p.deal_number,
    deal_year: p.deal_year,
    hay: `${p.name} ${p.client} ${p.city ?? ""}`.toLowerCase(),
  });
  const columns = defs
    .filter((d) => d.key !== "deposit_received" && d.key !== "closed")
    .map((d) => ({ key: d.key, label: d.label }));
  const counts = { sales: salesLeads.length, progress: active.length, closed: closed.length + lostLeads.length };

  return (
    <>
      <PageHeader
        title="Deals"
        description={crew ? "Jobs you're on." : "Every customer job, from first call to final payment."}
        actions={
          !crew ? (
            <Link
              href="/deals/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              <Plus className="size-4" /> New deal
            </Link>
          ) : null
        }
      />

      <form className="mb-3 flex gap-2" action="/deals">
        <input type="hidden" name="seg" value={seg} />
        <label className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="#10231, name, phone, address"
            className="h-11 w-full rounded-md border bg-card pr-3 pl-9 text-base md:text-sm"
            inputMode="search"
          />
        </label>
      </form>

      {!crew ? (
        <nav className="mb-4 grid grid-cols-3 rounded-lg bg-muted p-1 text-sm font-medium sm:w-[28rem]">
          {SEGMENTS.map((x) => (
            <Link
              key={x.key}
              href={`/deals?seg=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md text-muted-foreground",
                seg === x.key && "bg-card text-foreground shadow-sm",
              )}
            >
              {x.label}
              <span className="text-xs text-muted-foreground">{counts[x.key]}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {seg === "sales" ? (
        <>
          <div className="flex flex-col gap-5 lg:hidden">
            {stages
              .filter((x) => x.active && x.key !== "won" && x.key !== "lost")
              .map((st) => {
                const items = salesLeads.filter((l) => l.stage_id === st.id && match(leadHay(l)));
                if (q && !items.length) return null;
                return (
                  <section key={st.id}>
                    <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                      {st.label} <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
                    </h2>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {items.map((l) => (
                          <LeadCard key={l.id} lead={l} tz={s.timezone} now={now} lost={false} unread={unread.leads.has(l.id)} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            {salesLeads.length === 0 ? (
              <EmptyState title="No open deals" description="Tap + → New deal or Paste a message." />
            ) : null}
          </div>
          <div className="hidden lg:block">
            <LeadBoard
              stages={stages.filter((x) => x.active && x.key !== "won")}
              leads={leads.filter((l) => stageKey.get(l.stage_id) !== "won" && match(leadHay(l)))}
              reasons={reasons.filter((r) => r.active)}
              tz={s.timezone}
              nowIso={now.toISOString()}
              unread={[...unread.leads]}
            />
          </div>
        </>
      ) : null}

      {seg === "progress" ? (
        active.length === 0 ? (
          <EmptyState
            title={crew ? "No jobs assigned to you" : "No jobs in progress"}
            description={crew ? undefined : "A deal moves here when its deposit is recorded."}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2 lg:hidden">
              {active
                .filter((p) => match(projHay(p)))
                .map((p) => (
                  <ProjectCard key={p.id} project={p} today={today} unread={unread.projects.has(p.id)} />
                ))}
            </div>
            <div className="hidden lg:block">
              <ProjectBoard
                columns={columns}
                projects={active.filter((p) => match(projHay(p)))}
                today={today}
                canDrag={!crew}
                unread={[...unread.projects]}
              />
            </div>
          </>
        )
      ) : null}

      {seg === "closed" ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {closed
            .filter((p) => match(projHay(p)))
            .map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <Link href={`/deals/${p.deal_year}/${p.deal_number}`} className="min-w-0 font-medium hover:underline">
                  <span className="mr-1.5 text-xs text-muted-foreground">
                    {p.deal_number && p.deal_year ? dealLabel(p.deal_number, p.deal_year, year) : ""}
                  </span>
                  {p.name}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  {p.closed_at ? formatDate(p.closed_at.slice(0, 10)) : ""}
                  {p.locked_margin_bps !== null ? <Badge variant="secondary">{formatBps(p.locked_margin_bps)}</Badge> : null}
                </span>
              </li>
            ))}
          {lostLeads
            .filter((l) => match(leadHay(l)))
            .map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <Link href={`/deals/${l.deal_year}/${l.deal_number}`} className="min-w-0 font-medium hover:underline">
                  <span className="mr-1.5 text-xs text-muted-foreground">{dealLabel(l.deal_number, l.deal_year, year)}</span>
                  {l.name}
                </Link>
                <Badge variant="outline">Lost</Badge>
              </li>
            ))}
          {closed.length + lostLeads.length === 0 ? (
            <li className="p-4">
              <EmptyState title="Nothing closed yet" />
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}
