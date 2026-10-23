"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, MessageSquare } from "lucide-react";
import { smsHref } from "@/lib/leads/auto-reply";
import { markReplied } from "@/server/actions/deals";

/** One tap to send my qualifying questions + booking link. Sending stamps first_response_at. */
export function AutoReplyCard({
  dealId,
  phone,
  message,
  waitingLabel,
}: {
  dealId: string;
  phone: string | null;
  message: string;
  waitingLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const done = (via: "text" | "fb_msg") =>
    start(async () => {
      await markReplied({ deal_id: dealId, via });
      router.refresh();
    });
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-[1.5px] ring-destructive/40">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Reply now</h2>
        <span className="text-sm font-semibold text-destructive">{waitingLabel}</span>
      </div>
      <p className="max-h-40 overflow-y-auto rounded-xl bg-secondary p-3 text-sm whitespace-pre-wrap">{message}</p>
      <div className="grid grid-cols-2 gap-2">
        {phone ? (
          <a
            href={smsHref(phone, message)}
            onClick={() => done("text")}
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
              await navigator.clipboard.writeText(message);
              setCopied(true);
            } catch {
              setCopied(false);
            }
            done("fb_msg");
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-semibold"
        >
          <Copy className="size-5" /> {copied ? "Copied" : "Copy for Messenger"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Sending or copying logs your first reply (speed-to-lead).</p>
    </section>
  );
}
