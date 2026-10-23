import { Badge } from "@/components/ui/badge";
import { formatDate, isPaymentOverdue } from "@/lib/dates";

export function PaymentStatus({
  p,
  today,
}: {
  p: { status: string; due_date: string | null; received_on: string | null };
  today: string;
}) {
  if (p.status === "received")
    return <Badge variant="success">Received {formatDate(p.received_on)}</Badge>;
  if (isPaymentOverdue(p, today))
    return <Badge variant="destructive">Overdue · due {formatDate(p.due_date)}</Badge>;
  if (p.status === "due")
    return <Badge variant="warning">Due {p.due_date ? formatDate(p.due_date) : "now"}</Badge>;
  return <Badge variant="outline">Not due yet</Badge>;
}
