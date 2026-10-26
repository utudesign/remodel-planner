"use client";

import { useState } from "react";
import { ClipboardPaste, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NewDealForm, type NewDealDefaults, type StartStage } from "@/components/deals/new-deal-form";
import { parseLeadMessage } from "@/lib/leads/parse-message";

/** New deal: type it, paste a Facebook message (we read name/phone/what/town; town is kept until you pick an address), or log a missed call. */
export function NewDealEntry({ mode, stages }: { mode: "manual" | "paste" | "call"; stages: StartStage[] }) {
  const [text, setText] = useState("");
  const [defaults, setDefaults] = useState<NewDealDefaults>(
    mode === "call"
      ? { source: "call", notes: "Missed call — call back", stage: "new" }
      : mode === "paste"
        ? { stage: "new" }
        : {},
  );
  const [version, setVersion] = useState(0);
  const [found, setFound] = useState<string | null>(null);

  function read(value = text) {
    const p = parseLeadMessage(value);
    setDefaults({
      name: p.name ?? undefined,
      phone: p.phone ?? undefined,
      city: p.city ?? undefined,
      scope: p.scope ?? undefined,
      source: p.source ?? "marketplace",
      notes: p.notes,
      stage: "new",
    });
    setVersion((v) => v + 1);
    const bits = [p.name && "name", p.phone && "phone", p.scope && "what they want", p.city && "town"].filter(Boolean);
    setFound(bits.length ? `Found ${bits.join(", ")}. Check it below.` : "Couldn't find details. Fill them in below.");
  }

  return (
    <div className="flex flex-col gap-5">
      {mode === "paste" ? (
        <section className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <label htmlFor="paste" className="text-sm font-semibold">
            Paste the Facebook / text message
          </label>
          <Textarea
            id="paste"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hi, is this still available? I need new cabinets in Burke… 703-555-0102"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  setText(t);
                  read(t);
                } catch {
                  setFound("Tap and hold in the box, then Paste.");
                }
              }}
            >
              <ClipboardPaste /> Paste
            </Button>
            <Button type="button" onClick={() => read()} disabled={!text.trim()}>
              <Wand2 /> Read it
            </Button>
          </div>
          {found ? <p className="text-sm text-muted-foreground">{found}</p> : null}
        </section>
      ) : null}
      <NewDealForm key={version} defaults={defaults} stages={stages} />
    </div>
  );
}
