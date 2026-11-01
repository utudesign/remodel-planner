import Link from "next/link";
import { KanbanSquare, List, Plus, Search } from "lucide-react";
import { DealsBoard } from "@/components/deals/deals-board";
import { DealFilters } from "@/components/deals/deal-filters";
import { SCOPES, SOURCES } from "@/lib/deals/display";
import { DealCard } from "@/components/deals/deal-card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { parseDealNumber } from "@/lib/deals/dealNumber";
import { segmentOf, type Segment } from "@/lib/deals/segments";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";
import { getStages, getWorkspaces, listDeals, type DealRow } from "@/server/queries/deals";

export const metadata = { title: "Deals" };

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "selling", label: "Selling" },
  { key: "sold", label: "Sold" },
  { key: "closed", label: "Closed" },
];

/** Search: 26-1047, #26-1047, 261047, 1047 (this year), 26-1047-E2, or name / phone / address. */
function matcher(q: string, currentYear: number) {
  const text = q.trim().toLowerCase();
  const n = parseDealNumber(q);
  const digits = text.replace(/\D/g, "");
  return (d: DealRow) => {
    if (!text) return true;
    if (n) {
      const year = n.year ?? currentYear;
      if (d.deal_year === year && Number(d.deal_number.slice(3)) === n.seq) return true;
    }
    const hay = `${d.contact?.name ?? ""} ${d.title ?? ""} ${d.contact?.address ?? ""} ${d.contact?.city ?? ""}`.toLowerCase();
    if (hay.includes(text)) return true;
    const phone = (d.contact?.phone ?? "").replace(/\D/g, "");
    return digits.length >= 4 && phone.includes(digits);
  };
}

type Params = { seg?: string; q?: string; view?: string; scope?: string; source?: string; owner?: string; overdue?: string; shared?: string };

/** Deals (v3 E1): the home screen. Selling = a board by stage (or a list); Sold and Closed = lists. Filters in the URL. */
export default async function DealsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { seg: segParam, q = "" } = sp;
  const s = await requireStaff();
  const [stages, allDeals, people, workspaces, reasons] = await Promise.all([
    getStages(s),
    listDeals(s),
    s.db.from("users").select("id, name, role, active").eq("company_id", s.companyId).then(must),
    getWorkspaces(s),
    s.db.from("lost_reasons").select("key, label, active, sort_order").eq("company_id", s.companyId).order("sort_order").then(must),
  ]);
  const now = new Date();
  const nowMs = now.getTime();
  const deals = allDeals.filter(
    (d) =>
      (!sp.scope || d.scope === sp.scope) &&
      (!sp.source || d.source === sp.source) &&
      (!sp.owner || d.owner_id === sp.owner) &&
      (!sp.shared || (d.workspace_id && d.workspace_id !== s.workspaceId)) &&
      (!sp.overdue || (!!d.next_follow_up_at && new Date(d.next_follow_up_at).getTime() < nowMs)),
  );
  const board = sp.view !== "list";
  const wsName = new Map(workspaces.map((w) => [w.id, w.name]));
  const firstName = new Map(people.map((p) => [p.id, (p.name ?? "").split(" ")[0] || null]));
  const year = Number(todayIn(s.timezone).slice(0, 4));
  const kind = new Map(stages.map((x) => [x.key, x.kind]));
  const match = matcher(q, year);

  const bySeg: Record<Segment, DealRow[]> = { selling: [], sold: [], closed: [] };
  for (const d of deals) {
    const seg = segmentOf({
      stageKind: kind.get(d.stage),
      cancelled_at: d.cancelled_at,
      paid_in_full_at: d.paid_in_full_at,
    });
    bySeg[seg].push(d);
  }
  // A search looks across every segment.
  const seg: Segment = q
    ? (SEGMENTS.find((x) => bySeg[x.key].some(match))?.key ?? "selling")
    : (SEGMENTS.find((x) => x.key === segParam)?.key ?? "selling");
  const shown = bySeg[seg].filter(match);

  const card = (d: DealRow) => (
    <DealCard
      key={d.id}
      deal={d}
      stageKind={kind.get(d.stage)}
      ownerName={d.owner_id ? firstName.get(d.owner_id) : null}
      sharedBy={d.workspace_id && d.workspace_id !== s.workspaceId ? (wsName.get(d.workspace_id) ?? "another workspace") : null}
      now={now}
    />
  );

  return (
    <>
      <PageHeader
        title="Deals"
        actions={
          <Link
            href="/deals/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New deal
          </Link>
        }
      />

      <form className="mb-3 max-w-2xl" action="/deals" role="search">
        <input type="hidden" name="seg" value={seg} />
        <label className="relative block">
          <span className="sr-only">Search deals</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="26-1047, name, phone, address"
            className="h-11 w-full rounded-xl border-0 bg-card pr-3 pl-9 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            inputMode="search"
            enterKeyHint="search"
          />
        </label>
      </form>

      <DealFilters
        scopes={SCOPES.map((x) => ({ key: x.key, label: x.label }))}
        sources={SOURCES.map((x) => ({ key: x.key, label: x.label }))}
        people={people.filter((p) => p.active && p.role !== "crew" && p.role !== "customer").map((p) => ({ id: p.id, name: p.name ?? "Someone" }))}
        showShared={workspaces.length > 1}
      />

      <div className="mb-4 flex items-center gap-2">
      <nav className="grid flex-1 grid-cols-3 rounded-xl bg-muted p-1 text-sm font-semibold sm:max-w-[28rem]">
        {SEGMENTS.map((x) => (
          <Link
            key={x.key}
            href={`/deals?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "q")), seg: x.key }).toString()}`}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-lg text-muted-foreground",
              seg === x.key && "bg-card text-foreground shadow-sm",
            )}
          >
            {x.label}
            <span className="text-xs font-normal">{bySeg[x.key].length}</span>
          </Link>
        ))}
      </nav>
        {seg === "selling" && !q ? (
          <Link
            href={`/deals?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "view")), ...(board ? { view: "list" } : {}) }).toString()}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border"
            aria-label={board ? "Show as list" : "Show as board"}
          >
            {board ? <List className="size-5" /> : <KanbanSquare className="size-5" />}
          </Link>
        ) : null}
      </div>

      {q ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {shown.length} match{shown.length === 1 ? "" : "es"} for “{q}” ·{" "}
          <Link href={`/deals?seg=${seg}`} className="text-primary underline">
            clear
          </Link>
        </p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          title={q ? "No deal matches" : seg === "selling" ? "No open deals" : seg === "sold" ? "No jobs in progress" : "Nothing closed yet"}
          description={seg === "selling" && !q ? "Tap + → New deal, or paste a Facebook message." : undefined}
        />
      ) : seg === "selling" && !q && board ? (
        <DealsBoard
          stages={stages.filter((st) => st.active || st.kind !== "open").map((st) => ({ key: st.key, label: st.label, kind: st.kind as "open" | "handed_off" | "lost" }))}
          deals={shown.map((d) => ({
            deal: d,
            ownerName: d.owner_id ? (firstName.get(d.owner_id) ?? null) : null,
            sharedBy: d.workspace_id && d.workspace_id !== s.workspaceId ? (wsName.get(d.workspace_id) ?? "another workspace") : null,
          }))}
          reasons={reasons.filter((r) => r.active).map((r) => ({ key: r.key, label: r.label }))}
          nowMs={nowMs}
        />
      ) : seg === "selling" && !q ? (
        <div className="flex flex-col gap-5">
          {stages
            .filter((st) => st.kind === "open")
            .map((st) => {
              const items = shown.filter((d) => d.stage === st.key);
              if (!items.length) return null;
              return (
                <section key={st.key}>
                  <h2 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {st.label} <span>{items.length}</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(card)}</div>
                </section>
              );
            })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{shown.map(card)}</div>
      )}
    </>
  );
}
