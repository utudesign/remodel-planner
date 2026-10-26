"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Plus, Search } from "lucide-react";
import { formatCents } from "@/lib/money";
import { isExact, parseItemQuery, type FoundItem } from "@/lib/item-search";
import { cn } from "@/lib/utils";
import { addCatalogItem, findCatalogItems } from "@/server/actions/estimates";

/**
 * Add items by code: type "B36" → just B36 (and B36FH…), Enter or + adds it, the box clears
 * for the next code. "2 B36" / "B36 x2" adds two. Nothing is listed until you type.
 */
export function ItemSearch({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const box = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [text, setText] = useState("");
  const [items, setItems] = useState<FoundItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, start] = useTransition();
  const { term, qty } = parseItemQuery(text);

  useEffect(() => {
    if (!term) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await findCatalogItems({ quote_id: quoteId, q: text });
        if (n !== seq.current) return;
        setItems(found);
        setActive(0);
        setError(null);
      } catch {
        if (n === seq.current) setError("Search failed. Check your signal and try again.");
      } finally {
        if (n === seq.current) setSearching(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [term, text, quoteId]);

  function add(item: FoundItem) {
    start(async () => {
      const r = await addCatalogItem({ quote_id: quoteId, catalog_item_id: item.id, qty });
      if (r && !r.ok) {
        setError(r.error ?? "Could not add it");
        return;
      }
      setAdded(`Added ${qty > 1 ? `${qty} × ` : ""}${item.code || item.name}`);
      seq.current++;
      setText("");
      setItems([]);
      setError(null);
      box.current?.focus();
      router.refresh();
    });
  }

  const shown = term ? items : [];
  return (
    <div className="flex flex-col gap-2">
      <label className="relative">
        <span className="sr-only">Add an item by code</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={box}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAdded(null);
            if (!parseItemQuery(e.target.value).term) {
              seq.current++;
              setItems([]);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(shown.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = shown[active];
              if (pick && !adding) add(pick);
            } else if (e.key === "Escape") {
              setText("");
              setItems([]);
            }
          }}
          placeholder="Type a code: B36, W3030, SB36…"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="h-12 w-full rounded-xl bg-secondary pr-10 pl-9 text-base font-medium tracking-wide outline-none focus:ring-2 focus:ring-ring"
        />
        {searching || adding ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </label>

      {added && !term ? <p className="text-sm font-medium text-primary">✓ {added}. Type the next code.</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {term && !searching && !shown.length && !error ? (
        <p className="rounded-xl px-3 py-2 text-sm text-muted-foreground ring-1 ring-border">
          No item with code “{term.toUpperCase()}”. Check the code, or add it as a custom item below.
        </p>
      ) : null}

      {shown.length ? (
        <ul className="flex flex-col overflow-hidden rounded-xl ring-1 ring-border">
          {shown.map((r, i) => {
            const exact = isExact(r, term);
            return (
              <li key={r.id} className={cn("border-b border-border/60 last:border-0", i === active && "bg-accent/60")}>
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => add(r)}
                  onMouseEnter={() => setActive(i)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span className={cn("min-w-16 font-mono text-[15px] font-bold", exact && "text-primary")}>{r.code || "—"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.fixed ? "sells" : "cost"} {formatCents(r.price_cents)} / {r.unit}
                      {i === active ? (
                        <span className="ml-2 hidden items-center gap-0.5 sm:inline-flex">
                          <CornerDownLeft className="size-3" /> Enter
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex h-10 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                    <Plus className="size-4" />
                    {qty > 1 ? qty : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">Tip: “2 B36” or “B36 x2” adds two. Words work too (sink, faucet).</p>
    </div>
  );
}
