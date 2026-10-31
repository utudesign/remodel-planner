"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importSkylinePriceList } from "@/server/actions/settings";

/** Settings → Price lists (v3 batch C): which brands are loaded, and the Skyline import / refresh button. */
export function PriceLists({
  lists,
}: {
  lists: { id: string; vendor: string; name: string; effective_date: string; items: number; colors: number }[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const skyline = lists.find((l) => l.vendor === "Skyline");
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Price lists</h2>
      {lists.length ? (
        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-border">
          {lists.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block font-semibold">{l.vendor}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {l.name} · {l.items.toLocaleString("en-US")} items · {l.colors} colors · {l.effective_date}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No price lists loaded yet.</p>
      )}
      <Button
        variant={skyline ? "secondary" : "default"}
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await importSkylinePriceList();
            setMsg(r?.ok ? { ok: true, text: r.message ?? "Loaded" } : { ok: false, text: r?.error ?? "Import failed" });
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Loading Skyline (about a minute)…" : skyline ? "Refresh Skyline prices" : "Load Skyline (Spring Forest 2026)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Skyline: Spring Forest 2026 lists, 32 colors, cost = list × 0.35. Refreshing updates prices in place; estimates
        keep the prices they were made with.
      </p>
      {msg ? <p className={msg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{msg.text}</p> : null}
    </div>
  );
}
