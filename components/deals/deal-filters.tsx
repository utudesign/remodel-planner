"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

/** Deals filters (E1): scope, source, salesperson, overdue only, shared only. Kept in the URL. */
export function DealFilters({
  scopes,
  sources,
  people,
  showShared,
}: {
  scopes: { key: string; label: string }[];
  sources: { key: string; label: string }[];
  people: { id: string; name: string }[];
  showShared: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.replace(`/deals?${n.toString()}`);
  };
  const toggle = (k: string) => set(k, sp.get(k) ? null : "1");
  const active = ["scope", "source", "owner", "overdue", "shared"].some((k) => sp.get(k));
  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <NativeSelect aria-label="Scope" value={sp.get("scope") ?? ""} onChange={(e) => set("scope", e.target.value || null)} className="h-10 w-auto shrink-0 text-sm">
        <option value="">Any scope</option>
        {scopes.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="Source" value={sp.get("source") ?? ""} onChange={(e) => set("source", e.target.value || null)} className="h-10 w-auto shrink-0 text-sm">
        <option value="">Any source</option>
        {sources.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </NativeSelect>
      {people.length > 1 ? (
        <NativeSelect aria-label="Salesperson" value={sp.get("owner") ?? ""} onChange={(e) => set("owner", e.target.value || null)} className="h-10 w-auto shrink-0 text-sm">
          <option value="">Anyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      <Toggle on={!!sp.get("overdue")} onClick={() => toggle("overdue")} label="Overdue" danger />
      {showShared ? <Toggle on={!!sp.get("shared")} onClick={() => toggle("shared")} label="Shared" /> : null}
      {active ? (
        <button
          type="button"
          onClick={() => {
            const n = new URLSearchParams(sp.toString());
            ["scope", "source", "owner", "overdue", "shared"].forEach((k) => n.delete(k));
            router.replace(`/deals?${n.toString()}`);
          }}
          className="h-10 shrink-0 px-2 text-sm font-semibold text-primary"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function Toggle({ on, onClick, label, danger }: { on: boolean; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-10 shrink-0 rounded-xl px-3 text-sm font-semibold ring-1 ring-border",
        on ? (danger ? "bg-destructive text-white ring-destructive" : "bg-foreground text-background") : "bg-card",
      )}
    >
      {label}
    </button>
  );
}
