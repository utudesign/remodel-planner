import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { PaymentStatus } from "@/components/payments/payment-status";
import { ReceiveDialog } from "@/components/payments/receive-dialog";
import { requirePageRole } from "@/lib/auth/require-role";
import { isPaymentOverdue, todayIn } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getAllPayments } from "@/server/queries/payments";

export const metadata = { title: "Payments" };

const FILTERS = [
  { key: "open", label: "Owed" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Not due yet" },
  { key: "received", label: "Received" },
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f = "open" } = await searchParams;
  const s = await requirePageRole("owner", "team");
  const today = todayIn(s.timezone);
  const all = await getAllPayments(s);

  const overdue = all.filter((p) => isPaymentOverdue(p, today));
  const due = all.filter((p) => p.status === "due");
  const sum = (xs: typeof all) => xs.reduce((t, p) => t + p.amount_cents, 0);
  const monthStart = today.slice(0, 8) + "01";
  const receivedThisMonth = all.filter(
    (p) => p.status === "received" && (p.received_on ?? "") >= monthStart,
  );

  const list =
    f === "overdue"
      ? overdue
      : f === "upcoming"
        ? all.filter((p) => p.status === "pending")
        : f === "received"
          ? all
              .filter((p) => p.status === "received")
              .sort((a, b) => (b.received_on ?? "").localeCompare(a.received_on ?? ""))
          : due;

  return (
    <>
      <PageHeader title="Payments" description="Every installment across all projects." />

      <dl className="mb-5 grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Owed now</dt>
          <dd className="font-semibold tabular-nums">{formatCents(sum(due))}</dd>
        </div>
        <div
          className={cn(
            "rounded-lg border bg-card p-3",
            overdue.length && "border-destructive/50 bg-destructive/5",
          )}
        >
          <dt className="text-xs text-muted-foreground">Overdue</dt>
          <dd className={cn("font-semibold tabular-nums", overdue.length && "text-destructive")}>
            {formatCents(sum(overdue))}
          </dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Received this month</dt>
          <dd className="font-semibold tabular-nums">{formatCents(sum(receivedThisMonth))}</dd>
        </div>
      </dl>

      <nav className="mb-3 flex gap-1 overflow-x-auto">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/payments?f=${x.key}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-sm",
              f === x.key
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {x.label}
            {x.key === "overdue" && overdue.length ? ` (${overdue.length})` : ""}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <EmptyState
          title={f === "overdue" ? "Nothing overdue" : "Nothing here"}
          description={f === "open" ? "No installments are owed right now." : undefined}
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <Link
                  href={`/job/${p.project?.id}?tab=payments`}
                  className="font-medium hover:underline"
                >
                  {p.project?.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {p.label} ·{" "}
                  <span className="tabular-nums text-foreground">
                    {formatCents(p.amount_cents)}
                  </span>
                  {p.status === "received" && p.check_number ? ` · #${p.check_number}` : ""}
                </p>
                <div className="mt-1">
                  <PaymentStatus p={p} today={today} />
                </div>
              </div>
              {p.status === "due" ? (
                <ReceiveDialog payment={p} today={today} projectName={p.project?.name} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
