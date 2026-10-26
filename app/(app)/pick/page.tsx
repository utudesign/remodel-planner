import Link from "next/link";
import { ScopeBadge } from "@/components/deals/deal-card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { getStages, listDeals } from "@/server/queries/deals";

export const metadata = { title: "Pick a deal" };

const FOR = {
  estimate: { title: "Quick estimate for…", tab: "estimate" },
  photos: { title: "Take photos for…", tab: "photos" },
  log: { title: "Log a call for…", tab: "activity" },
} as const;

/** The + menu's deal picker: open deals, most recently touched first. */
export default async function PickDeal({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: f } = await searchParams;
  const target = FOR[(f ?? "log") as keyof typeof FOR] ?? FOR.log;
  const s = await requireStaff();
  const [stages, deals] = await Promise.all([getStages(s), listDeals(s)]);
  const open = new Set(stages.filter((x) => x.kind === "open").map((x) => x.key));
  const list = deals
    .filter((d) => open.has(d.stage))
    .sort((a, b) => (b.last_touch_at ?? b.created_at ?? "").localeCompare(a.last_touch_at ?? a.created_at ?? ""));
  return (
    <>
      <PageHeader title={target.title} />
      {list.length === 0 ? (
        <EmptyState title="No open deals" description="Start with + → New deal." />
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
          {list.map((d) => (
            <li key={d.id}>
              <Link
                href={`/deals/${d.deal_number}?tab=${target.tab}${target.tab === "activity" ? "#log" : ""}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2"
              >
                <span className="w-16 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">#{d.deal_number}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{d.contact?.name || d.title || "No name"}</span>
                <ScopeBadge scope={d.scope} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
