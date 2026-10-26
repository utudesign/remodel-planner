"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AddressProvider, AddressSuggestion } from "@/lib/address";
import { cn } from "@/lib/utils";

const ATTRIBUTION: Record<AddressProvider, string> = {
  google: "Powered by Google",
  geoapify: "Powered by Geoapify · © OpenStreetMap",
  photon: "© OpenStreetMap contributors",
};

const newSession = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/**
 * One-line US address with type-ahead suggestions (FedEx-style): type a few characters,
 * pick the real address. The form gets one line ("4100 Chain Bridge Rd, Fairfax, VA 22030");
 * the server splits it into street / town / ZIP. Typing your own text always works too.
 */
export function AddressInput({
  id,
  name = "address",
  defaultValue = "",
  placeholder = "Start typing the street address",
}: {
  id: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [provider, setProvider] = useState<AddressProvider | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef(newSession());
  const typed = useRef(false); // only search after the user types (not on the default value)
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 4) return; // onChange already closed the list
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/address?q=${encodeURIComponent(q)}&s=${session.current}`);
        const j = (await res.json()) as { provider?: AddressProvider; items?: AddressSuggestion[]; error?: string };
        if (n !== seq.current) return;
        setProvider(j.provider ?? null);
        setItems(j.items ?? []);
        setError(j.error ? "Suggestions are unavailable right now. Type the full address." : null);
        setActive(-1);
        setOpen(true);
      } catch {
        if (n === seq.current) setError("No connection. Type the full address.");
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  async function pick(s: AddressSuggestion) {
    typed.current = false;
    setOpen(false);
    setItems([]);
    let line = s.line;
    if (!line) {
      setLoading(true);
      try {
        const res = await fetch(`/api/address?place=${encodeURIComponent(s.id)}&s=${session.current}`);
        line = ((await res.json()) as { line?: string }).line ?? null;
      } catch {
        line = null;
      } finally {
        setLoading(false);
      }
    }
    setValue(line || [s.main, s.secondary].filter(Boolean).join(", "));
    session.current = newSession(); // a pick ends the billing session
  }

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="pr-9 pl-9"
          onChange={(e) => {
            typed.current = true;
            setValue(e.target.value);
            if (e.target.value.trim().length < 4) {
              seq.current++; // drop any lookup in flight
              setItems([]);
              setOpen(false);
            }
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              void pick(items[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border">
          <ul id={listId} role="listbox">
            {items.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => void pick(s)}
                  className={cn(
                    "flex min-h-12 w-full flex-col items-start justify-center px-3 py-2 text-left",
                    i === active ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <span className="text-[15px] font-medium">{s.main}</span>
                  {s.secondary ? <span className="text-xs text-muted-foreground">{s.secondary}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {!items.length ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {error ?? "No match yet. Keep typing, or use what you typed."}
            </p>
          ) : null}
          {provider ? (
            <p className="border-t px-3 py-1.5 text-right text-[11px] text-muted-foreground">{ATTRIBUTION[provider]}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
