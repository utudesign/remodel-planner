import Link from "next/link";
import { Hourglass, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/shared/avatar";
import { FollowUpBadge } from "@/components/shared/follow-up-badge";
import { formatBudget } from "@/lib/money";
import type { BoardLead } from "@/server/queries/leads";

export const SCOPE_LABEL: Record<string, string> = {
  cabinets: "Cabinets",
  counters: "Counters",
  full: "Full remodel",
  other: "Other",
};

export function LeadCard({
  lead,
  tz,
  now,
  lost,
  unread,
}: {
  lead: BoardLead;
  tz: string;
  now: Date;
  lost: boolean;
  unread: boolean;
}) {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - new Date(lead.stage_entered_at).getTime()) / 86_400_000),
  );
  const unanswered = !lead.first_response_at && !lost;
  return (
    <article className="relative rounded-lg border bg-card p-3 shadow-xs">
      {unread ? (
        <span
          aria-label="Updated"
          className="absolute top-2 -left-1 size-2.5 rounded-full bg-primary"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="min-w-0 font-medium leading-tight hover:underline"
        >
          {lead.name}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Avatar id={lead.owner?.id} name={lead.owner?.name} />
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              aria-label={`Call ${lead.name}`}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Phone className="size-4" />
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {lead.scope ? (
          <Badge variant="outline">{SCOPE_LABEL[lead.scope] ?? lead.scope}</Badge>
        ) : null}
        <Badge variant="outline">
          {formatBudget(lead.budget_min_cents, lead.budget_max_cents)}
        </Badge>
        <span className="text-muted-foreground">
          {days === 0 ? "new in stage" : `${days}d in stage`}
        </span>
        {unanswered && lead.waiting_for_live ? (
          <Badge variant="warning">
            <Hourglass /> waiting for live shift
          </Badge>
        ) : null}
      </div>
      {!lost ? (
        <div className="mt-2">
          <FollowUpBadge at={lead.next_follow_up_at} tz={tz} now={now} />
        </div>
      ) : null}
    </article>
  );
}
