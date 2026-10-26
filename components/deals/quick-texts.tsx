"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MessageSquare, Settings2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { smsHref } from "@/lib/leads/auto-reply";
import { cn } from "@/lib/utils";
import { logTextSent } from "@/server/actions/deals";

export type QuickText = { key: string; label: string; text: string; sent: boolean; missingLink: boolean };

/**
 * My ready-made texts for this deal (Settings → Texts). The next one in the sequence is open;
 * tap another chip to switch. Edit the words if you like, then Text it (opens Messages) or Copy.
 * Sending logs it, and the follow-up moves to the next text's day.
 */
export function QuickTexts({
  dealId,
  phone,
  firstName,
  texts,
  suggestedKey,
  hint,
}: {
  dealId: string;
  phone: string | null;
  firstName: string;
  texts: QuickText[];
  suggestedKey: string | null;
  hint: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [key, setKey] = useState(suggestedKey ?? texts[0]?.key ?? "");
  const current = texts.find((t) => t.key === key) ?? texts[0];
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  if (!current) return null;
  const body = edits[current.key] ?? current.text;
  const log = (via: "text" | "fb_msg") =>
    start(async () => {
      await logTextSent({ deal_id: dealId, key: current.key, via });
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Text {firstName}</h2>
        <Link
          href="/settings/texts"
          className="-mr-2 flex size-10 items-center justify-center rounded-lg text-muted-foreground"
          aria-label="Edit my texts"
        >
          <Settings2 className="size-4" />
        </Link>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Which text">
        {texts.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={t.key === current.key}
            onClick={() => {
              setKey(t.key);
              setCopied(false);
            }}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap",
              t.key === current.key ? "bg-foreground text-background" : "bg-secondary",
              t.sent && t.key !== current.key && "text-muted-foreground line-through decoration-1",
            )}
          >
            {t.key === suggestedKey ? "★ " : ""}
            {t.label}
          </button>
        ))}
      </div>
      {current.key === suggestedKey && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {current.sent ? <p className="text-xs text-muted-foreground">Already sent at this stage.</p> : null}
      <Textarea
        value={body}
        onChange={(e) => setEdits((m) => ({ ...m, [current.key]: e.target.value }))}
        rows={3}
        aria-label="Message"
        className="text-[15px]"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{current.missingLink ? "Share the estimate first (Estimate tab → Show the client)." : ""}</span>
        <span className={cn(body.length > 320 && "text-destructive")}>{body.length} chars</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {phone ? (
          <a
            href={smsHref(phone, body)}
            onClick={() => log("text")}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            <MessageSquare className="size-5" /> Text it
          </a>
        ) : (
          <span className="flex h-12 items-center justify-center rounded-xl bg-secondary text-sm text-muted-foreground">
            No phone yet
          </span>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(body);
              setCopied(true);
            } catch {
              setCopied(false);
            }
            log("fb_msg");
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-semibold"
        >
          <Copy className="size-5" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
