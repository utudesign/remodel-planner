"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { setMeetingStatus } from "@/server/actions/leads";

const TYPE: Record<string, string> = {
  initial: "In-home measure",
  design_review: "Design presentation",
  mid_check: "Mid-project check",
  final: "Final walkthrough",
};

export function MeetingRow({
  meeting,
  tz,
}: {
  meeting: { id: string; type: string; scheduled_at: string; status: string; notes: string | null };
  tz: string;
}) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
      <div>
        <p className="font-medium">{TYPE[meeting.type] ?? meeting.type}</p>
        <p className="text-muted-foreground">{formatDateTime(meeting.scheduled_at, tz)}</p>
        {meeting.notes ? <p className="text-xs text-muted-foreground">{meeting.notes}</p> : null}
      </div>
      {meeting.status === "scheduled" ? (
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Mark done"
            disabled={pending}
            onClick={() =>
              start(
                async () =>
                  void (await setMeetingStatus({ meeting_id: meeting.id, status: "done" })),
              )
            }
          >
            <Check />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancel meeting"
            disabled={pending}
            onClick={() =>
              start(
                async () =>
                  void (await setMeetingStatus({ meeting_id: meeting.id, status: "canceled" })),
              )
            }
          >
            <X />
          </Button>
        </div>
      ) : (
        <Badge variant={meeting.status === "done" ? "success" : "outline"}>{meeting.status}</Badge>
      )}
    </li>
  );
}
