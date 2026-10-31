"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { utcToDatetimeLocal } from "@/lib/dates";
import { followUpLabel } from "@/lib/deals/follow-up-bump";
import { cn } from "@/lib/utils";
import { bumpFollowUp, moveDealStage, setFollowUpAt } from "@/server/actions/jacket";
import type { Stage } from "@/server/queries/deals";

type Reason = { key: string; label: string; active: boolean };

/**
 * Stage + follow-up (change request v3 item 4). Replaces the dropdown + Move button:
 *   - a horizontal stepper (current stage highlighted, earlier ones ticked), tap a stage to jump;
 *     going back asks first; Sold opens Mark sold (the database allows no other way); Lost asks why
 *   - a big "Next: <stage>" button
 *   - the follow-up as plain text with +1 day / +3 days / +1 week / Pick date
 * Every move is written to History by the database (0018).
 */
export function StageStepper({
  dealId,
  number,
  stage,
  stages,
  reasons,
  lostReason,
  followUpAt,
  tz,
  nowMs,
}: {
  dealId: string;
  number: string;
  stage: string;
  stages: Stage[];
  reasons: Reason[];
  lostReason: string | null;
  followUpAt: string | null;
  tz: string;
  /** Server render time, so "overdue" / "Today" are stable (React render purity). */
  nowMs: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askLost, setAskLost] = useState(false);
  const [reason, setReason] = useState("");
  const [picking, setPicking] = useState(false);
  const [pickAt, setPickAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const strip = useRef<HTMLOListElement>(null);

  const path = stages
    .filter((s) => (s.active && s.kind !== "lost") || s.key === stage)
    .filter((s) => s.kind !== "lost")
    .sort((a, b) => a.sort_order - b.sort_order);
  const lostStage = stages.find((s) => s.kind === "lost" && s.active) ?? stages.find((s) => s.kind === "lost");
  const cur = stages.find((s) => s.key === stage);
  const isLost = cur?.kind === "lost";
  const isSold = cur?.kind === "handed_off";
  const idx = path.findIndex((s) => s.key === stage);
  const next = !isLost && !isSold && idx >= 0 ? path[idx + 1] : undefined;

  // Keep the current stage in view on a phone.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>("[data-current=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [stage]);

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string } | undefined | null | void>) {
    setError(null);
    setBusy(key);
    start(async () => {
      const res = await fn();
      if (res && !res.ok) setError(res.error ?? "Couldn't save");
      setBusy(null);
    });
  }

  function go(to: Stage) {
    if (to.key === stage) return;
    if (to.kind === "handed_off") return; // a link, handled below
    const toIdx = path.findIndex((s) => s.key === to.key);
    if (!isLost && toIdx >= 0 && toIdx < idx && !window.confirm(`Move this deal back to "${to.label}"?`)) return;
    if (isLost && !window.confirm(`Reopen this deal at "${to.label}"?`)) return;
    run(to.key, () => moveDealStage({ deal_id: dealId, stage: to.key }));
  }

  const followUp = followUpAt ? new Date(followUpAt) : null;
  const overdue = !!followUp && followUp.getTime() < nowMs;

  return (
    <div className="flex flex-col gap-4">
      <ol ref={strip} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Stage">
        {path.map((s, i) => {
          const done = !isLost && idx >= 0 && i < idx;
          const here = s.key === stage;
          const cls = cn(
            "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap",
            here ? "bg-primary text-primary-foreground" : done ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground",
            isSold && !here && "opacity-60",
          );
          const body = (
            <>
              {busy === s.key ? <Loader2 className="size-4 animate-spin" /> : done ? <Check className="size-4" /> : null}
              {s.label}
            </>
          );
          return (
            <li key={s.key} data-current={here}>
              {s.kind === "handed_off" && !isSold ? (
                <Link href={`/deals/${number}?tab=job`} className={cls} aria-label={`${s.label}: open Mark sold`}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  className={cls}
                  aria-current={here ? "step" : undefined}
                  disabled={pending || isSold}
                  onClick={() => go(s)}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {isSold ? (
        <p className="rounded-xl bg-secondary p-3 text-sm">
          Sold. The job timeline takes over on the{" "}
          <Link href={`/deals/${number}?tab=job`} className="font-semibold text-primary">
            Job tab
          </Link>
          .
        </p>
      ) : isLost ? (
        <p className="rounded-xl bg-secondary p-3 text-sm">
          Lost: {reasons.find((r) => r.key === lostReason)?.label ?? lostReason ?? "no reason"}. Tap a stage above to
          reopen it.
        </p>
      ) : next ? (
        next.kind === "handed_off" ? (
          <Link
            href={`/deals/${number}?tab=job`}
            className="flex h-12 items-center justify-center gap-1 rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Next: Mark sold <ChevronRight className="size-5" />
          </Link>
        ) : (
          <Button
            size="lg"
            className="h-12 rounded-xl text-base"
            disabled={pending}
            onClick={() => run(next.key, () => moveDealStage({ deal_id: dealId, stage: next.key }))}
          >
            {busy === next.key ? <Loader2 className="animate-spin" /> : null}
            Next: {next.label} <ChevronRight className="size-5" />
          </Button>
        )
      ) : null}

      {!isLost && !isSold && lostStage ? (
        askLost ? (
          <div className="flex flex-col gap-2 rounded-xl bg-secondary p-3">
            <p className="text-sm font-semibold">Why was it lost?</p>
            <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Lost reason">
              <option value="" disabled>
                Pick a reason
              </option>
              {reasons
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
            </NativeSelect>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={!reason || pending}
                onClick={() =>
                  run(lostStage.key, async () => {
                    const res = await moveDealStage({ deal_id: dealId, stage: lostStage.key, lost_reason: reason });
                    if (res?.ok) setAskLost(false);
                    return res;
                  })
                }
              >
                {busy === lostStage.key ? <Loader2 className="animate-spin" /> : null}
                Mark lost
              </Button>
              <Button variant="ghost" onClick={() => setAskLost(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAskLost(true)}
            className="-my-2 h-11 self-start text-sm font-semibold text-muted-foreground"
          >
            Mark lost…
          </button>
        )
      ) : null}

      {!isLost && !isSold ? (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className={cn("text-[15px] font-semibold", overdue ? "text-destructive" : !followUp && "text-destructive")}>
            {followUp ? `Follow up ${followUpLabel(followUp, new Date(nowMs), tz)}` : "No follow-up set"}
            {overdue ? " · overdue" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { d: 1, l: "+1 day" },
              { d: 3, l: "+3 days" },
              { d: 7, l: "+1 week" },
            ].map(({ d, l }) => (
              <Button
                key={d}
                variant="secondary"
                disabled={pending}
                onClick={() => run(`f${d}`, () => bumpFollowUp({ deal_id: dealId, days: d }))}
              >
                {busy === `f${d}` ? <Loader2 className="animate-spin" /> : null}
                {l}
              </Button>
            ))}
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setPickAt(followUp ? utcToDatetimeLocal(followUp, tz) : "");
                setPicking((p) => !p);
              }}
            >
              Pick date
            </Button>
          </div>
          {picking ? (
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={pickAt}
                onChange={(e) => setPickAt(e.target.value)}
                aria-label="Follow-up date and time"
              />
              <Button
                disabled={!pickAt || pending}
                onClick={() =>
                  run("pick", async () => {
                    const res = await setFollowUpAt({ deal_id: dealId, at: pickAt });
                    if (res?.ok) setPicking(false);
                    return res;
                  })
                }
              >
                {busy === "pick" ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
