"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { DealCard } from "@/components/deals/deal-card";
import type { StageKind } from "@/lib/deals/segments";
import { cn } from "@/lib/utils";
import { moveDealStage } from "@/server/actions/jacket";
import type { DealRow } from "@/server/queries/deals";

/**
 * Deals board (v3 item 17a, E1): a column per open stage + Sold + Lost. Drag a card (or "Move to…" on a phone)
 * to change its stage. Drop on Sold opens Mark sold (the database allows no other way in); drop on Lost asks why.
 * On a phone one column shows at a time, picked from the stage tabs.
 */
export type BoardStage = { key: string; label: string; kind: StageKind };
export type BoardDeal = { deal: DealRow; ownerName: string | null; sharedBy: string | null };

export function DealsBoard({
  stages,
  deals,
  reasons,
  nowMs,
}: {
  stages: BoardStage[];
  deals: BoardDeal[];
  reasons: { key: string; label: string }[];
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<BoardDeal | null>(null);
  const [reason, setReason] = useState("");
  const open = stages.filter((s) => s.kind === "open");
  const sold = stages.find((s) => s.kind === "handed_off");
  const lost = stages.find((s) => s.kind === "lost");
  const columns = [...open, ...(sold ? [sold] : []), ...(lost ? [lost] : [])];
  const [tab, setTab] = useState(open[0]?.key ?? "");
  const kindOf = new Map(stages.map((s) => [s.key, s.kind]));
  const stageOf = (d: BoardDeal) => local[d.deal.id] ?? d.deal.stage;
  const now = new Date(nowMs);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const move = (d: BoardDeal, to: string, lostReason?: string) => {
    const k = kindOf.get(to);
    if (to === stageOf(d)) return;
    if (k === "handed_off") {
      router.push(`/deals/${d.deal.deal_number}?tab=job`); // Mark sold checks the job-ready list
      return;
    }
    if (k === "lost" && !lostReason) {
      setReason("");
      setLostFor(d);
      return;
    }
    setLocal((m) => ({ ...m, [d.deal.id]: to }));
    setMoving(d.deal.id);
    setError(null);
    start(async () => {
      const r = await moveDealStage({ deal_id: d.deal.id, stage: to, lost_reason: lostReason ?? null });
      if (r && !r.ok) {
        setError(r.error ?? "Couldn't move it");
        setLocal((m) => {
          const n = { ...m };
          delete n[d.deal.id];
          return n;
        });
      }
      setMoving(null);
      router.refresh();
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over?.id;
    const d = deals.find((x) => x.deal.id === e.active.id);
    if (typeof to === "string" && d) move(d, to);
  };

  const counts = new Map<string, number>();
  for (const d of deals) counts.set(stageOf(d), (counts.get(stageOf(d)) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-2">
      {/* Phone: stage tabs, one column at a time */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden" role="tablist" aria-label="Stage">
        {open.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={tab === s.key}
            onClick={() => setTab(s.key)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold",
              tab === s.key ? "bg-foreground text-background" : "bg-card ring-1 ring-border",
            )}
          >
            {s.label} <span className="text-xs tabular-nums opacity-70">{counts.get(s.key) ?? 0}</span>
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 lg:-mx-0 lg:overflow-x-auto lg:pb-3">
          {columns.map((col) => {
            const list = col.kind === "open" ? deals.filter((d) => stageOf(d) === col.key) : [];
            const isDropOnly = col.kind !== "open";
            return (
              <Column
                key={col.key}
                id={col.key}
                label={col.label}
                count={isDropOnly ? null : list.length}
                hiddenOnPhone={col.key !== tab}
                dropOnly={isDropOnly}
                hint={col.kind === "handed_off" ? "Drop here → Mark sold" : col.kind === "lost" ? "Drop here → pick why" : null}
              >
                {!isDropOnly && list.length === 0 ? <p className="px-1 py-3 text-xs text-muted-foreground">No deals</p> : null}
                {list.map((d) => (
                  <Card
                    key={d.deal.id}
                    item={d}
                    kind={kindOf.get(stageOf(d))}
                    now={now}
                    busy={pending && moving === d.deal.id}
                    columns={columns}
                    current={stageOf(d)}
                    onMove={(to) => move(d, to)}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
      <p className="hidden text-xs text-muted-foreground lg:block">Drag a card to another stage. Sold opens Mark sold; Lost asks why.</p>

      {lostFor ? (
        <div role="dialog" aria-modal="true" aria-label="Why was it lost?" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-card p-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:rounded-2xl">
            <h2 className="text-lg font-bold">Why was #{lostFor.deal.deal_number} lost?</h2>
            <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3" aria-label="Lost reason">
              <option value="">Pick a reason…</option>
              {reasons.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setLostFor(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!reason}
                onClick={() => {
                  const d = lostFor;
                  setLostFor(null);
                  move(d, lost!.key, reason);
                }}
              >
                Mark lost
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Column({
  id,
  label,
  count,
  hiddenOnPhone,
  dropOnly,
  hint,
  children,
}: {
  id: string;
  label: string;
  count: number | null;
  hiddenOnPhone: boolean;
  dropOnly: boolean;
  hint: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl bg-secondary/60 p-2 lg:w-72 lg:shrink-0",
        hiddenOnPhone && "hidden lg:flex",
        dropOnly && "hidden border-2 border-dashed border-border bg-transparent lg:flex lg:w-40",
        isOver && "ring-2 ring-primary",
      )}
    >
      <h3 className="flex items-center justify-between px-1 pt-1 text-sm font-bold">
        {label} {count !== null ? <span className="text-xs font-semibold text-muted-foreground tabular-nums">{count}</span> : null}
      </h3>
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </section>
  );
}

function Card({
  item,
  kind,
  now,
  busy,
  columns,
  current,
  onMove,
}: {
  item: BoardDeal;
  kind: StageKind | undefined;
  now: Date;
  busy: boolean;
  columns: BoardStage[];
  current: string;
  onMove: (to: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.deal.id });
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("relative", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <DealCard deal={item.deal} stageKind={kind} ownerName={item.ownerName} sharedBy={item.sharedBy} now={now} />
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          aria-label={`Drag #${item.deal.deal_number}`}
          className="hidden h-9 w-7 cursor-grab touch-none items-center justify-center text-muted-foreground lg:flex"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        <NativeSelect
          aria-label={`Move #${item.deal.deal_number} to`}
          value=""
          onChange={(e) => e.target.value && onMove(e.target.value)}
          className="ml-auto h-9 w-auto py-0 text-xs"
        >
          <option value="">Move to…</option>
          {columns
            .filter((c) => c.key !== current)
            .map((c) => (
              <option key={c.key} value={c.key}>
                {c.kind === "handed_off" ? `${c.label} (Mark sold)` : c.label}
              </option>
            ))}
        </NativeSelect>
      </div>
    </div>
  );
}
