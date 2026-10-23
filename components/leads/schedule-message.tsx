"use client";

import { useRef, useTransition } from "react";
import { Check, Moon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { formatDateTime } from "@/lib/dates";
import { markMessageSent, scheduleMessage } from "@/server/actions/leads";

type Msg = { id: string; channel: string; body: string; send_at: string; sent_at: string | null };

/**
 * Client messages. During quiet hours (default 9 PM–8 AM ET) they're saved for the morning.
 * Phase 1: the app reminds you at send time; you send from your phone (no SMS provider yet).
 */
export function ScheduleMessage({
  leadId,
  phone,
  email,
  messages,
  tz,
  quietNow,
  nowIso,
}: {
  leadId: string;
  phone: string | null;
  email: string | null;
  messages: Msg[];
  tz: string;
  quietNow: boolean;
  nowIso: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionWithSuccess(scheduleMessage, () => ref.current?.reset());
  const [pending, start] = useTransition();
  const now = new Date(nowIso).getTime();
  return (
    <div id="messages" className="flex flex-col gap-3">
      {quietNow ? (
        <p className="flex items-center gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
          <Moon className="size-3.5" /> Quiet hours: anything you write now is saved for 8:00 AM.
        </p>
      ) : null}
      {messages.length ? (
        <ul className="flex flex-col divide-y rounded-md border">
          {messages.map((m) => {
            const due = !m.sent_at && new Date(m.send_at).getTime() <= now;
            const href =
              m.channel === "sms" && phone
                ? `sms:${phone}?&body=${encodeURIComponent(m.body)}`
                : m.channel === "email" && email
                  ? `mailto:${email}?body=${encodeURIComponent(m.body)}`
                  : phone
                    ? `tel:${phone}`
                    : undefined;
            return (
              <li key={m.id} className="flex flex-col gap-2 p-2.5 text-sm">
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {m.channel === "sms" ? "Text" : m.channel === "email" ? "Email" : "Call"} ·{" "}
                    {m.sent_at
                      ? `sent ${formatDateTime(m.sent_at, tz)}`
                      : `${due ? "due since" : "at"} ${formatDateTime(m.send_at, tz)}`}
                  </span>
                  {!m.sent_at ? (
                    <span className="flex gap-1.5">
                      {href ? (
                        <a
                          href={href}
                          className="inline-flex h-9 items-center gap-1 rounded-md border px-3 font-medium text-foreground"
                        >
                          <Send className="size-3.5" /> Open
                        </a>
                      ) : null}
                      <Button
                        size="sm"
                        className="h-9"
                        variant={due ? "default" : "secondary"}
                        disabled={pending}
                        onClick={() =>
                          start(async () => void (await markMessageSent({ message_id: m.id })))
                        }
                      >
                        <Check /> Sent
                      </Button>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form ref={ref} action={action} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="lead_id" value={leadId} />
        <Textarea
          name="body"
          rows={2}
          required
          placeholder="Hi Maria, confirming Saturday 10 AM…"
          className="col-span-2"
        />
        <NativeSelect name="channel" defaultValue="sms" aria-label="Channel">
          <option value="sms">Text</option>
          <option value="email">Email</option>
          <option value="call_reminder">Call reminder</option>
        </NativeSelect>
        <Input name="send_at" type="datetime-local" aria-label="Send at (optional)" />
        <div className="col-span-2 flex flex-col gap-1">
          <FormMessage state={state} />
          <SubmitButton variant="secondary" className="h-11">
            Save message
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
