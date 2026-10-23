import { AlarmClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, isFollowUpOverdue } from "@/lib/dates";

/** Red when overdue or missing (business rule 1: every open lead has a next step). */
export function FollowUpBadge({ at, tz, now }: { at: string | null; tz: string; now: Date }) {
  if (!at) return <Badge variant="destructive">No follow-up set</Badge>;
  const overdue = isFollowUpOverdue(at, now);
  return (
    <Badge variant={overdue ? "destructive" : "secondary"} className="font-normal">
      <AlarmClock />
      {overdue ? "Overdue · " : ""}
      {formatDateTime(at, tz)}
    </Badge>
  );
}
