import { Check, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireCustomer } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { whenText } from "@/lib/jobs/pm";
import { cn } from "@/lib/utils";
import { getCustomerJobs } from "@/server/queries/worker";

export const metadata = { title: "My kitchen" };

/** The customer's page (v3 F1): progress, what's next and the schedule. Their own job only (0022 views). */
export default async function MyJobPage() {
  const s = await requireCustomer();
  const today = todayIn(s.timezone);
  const { jobs, tasks } = await getCustomerJobs(s);
  if (jobs.length === 0) {
    return (
      <>
        <PageHeader title={`Hi ${s.name.split(" ")[0] || "there"}`} />
        <EmptyState title="Your project page opens when work is scheduled" description={`Questions? Call ${s.companyName}.`} />
      </>
    );
  }
  return (
    <>
      <PageHeader title={`Hi ${s.name.split(" ")[0] || "there"}`} description={`Your project with ${s.companyName}`} />
      <div className="flex flex-col gap-5">
        {jobs.map((j) => {
          const list = tasks.filter((t) => t.project_id === j.project_id);
          return (
            <div key={j.project_id} className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{j.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${j.pct ?? 0}%` }} />
                    </div>
                    <span className="text-lg font-bold tabular-nums">{j.pct ?? 0}%</span>
                  </div>
                  <p className="text-sm">
                    {j.closed_at ? "Finished. Thank you!" : j.current_step ? <>Now: <b>{j.current_step}</b></> : "Getting ready to start"}
                  </p>
                  {j.manager_name ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      Your project manager: {j.manager_name}
                      {j.manager_phone ? (
                        <a href={`tel:${j.manager_phone}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary">
                          <Phone className="size-4" /> Call
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">The schedule is being planned.</p>
                  ) : (
                    <ol className="flex flex-col">
                      {list.map((t) => {
                        const done = t.status === "done";
                        const now = !done && !!t.start_on && t.start_on <= today;
                        return (
                          <li key={t.id} className="flex min-h-12 items-center gap-3 border-b border-border/60 py-2 last:border-0">
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full",
                                done ? "bg-primary text-primary-foreground" : now ? "ring-2 ring-primary" : "ring-2 ring-input",
                              )}
                            >
                              {done ? <Check className="size-3.5" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block font-medium", done && "text-muted-foreground")}>{t.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {whenText({ start_on: t.start_on, end_on: t.end_on, start_time: null, end_time: null })}
                              </span>
                            </span>
                            {now && t.pct ? <span className="text-xs font-semibold tabular-nums">{t.pct}%</span> : null}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}
