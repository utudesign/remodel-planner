import { FeedbackForm } from "@/components/feedback/feedback-form";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { FEEDBACK_AREAS } from "@/lib/feedback";
import { must } from "@/server/action-utils";

export const metadata = { title: "Feedback" };

/**
 * Handbook feedback (0014). Everyone rates each area and says what to change; their own answers
 * come back prefilled. I (owner) also see everyone's answers, grouped by area.
 */
export default async function FeedbackPage() {
  const s = await requireStaff();
  const rows = must(
    await s.db.from("app_feedback").select("user_id, area, rating, works, change, updated_at").eq("company_id", s.companyId),
  );
  const mine = new Map(rows.filter((r) => r.user_id === s.userId).map((r) => [r.area, r]));
  const owner = s.role === "owner";
  const others = rows.filter((r) => r.user_id !== s.userId);
  const people = owner && others.length
    ? new Map(
        must(await s.db.from("users").select("id, name, email").in("id", [...new Set(others.map((r) => r.user_id))])).map((u) => [
          u.id,
          u.name || u.email || "Someone",
        ]),
      )
    : new Map<string, string>();

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Tell Tugu what works and what to change. Rate each part 1–5; you can come back and update it anytime."
      />

      {owner ? (
        <section className="mb-8 flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">What the team said</h2>
          {others.length === 0 ? (
            <EmptyState title="No feedback yet" description="Send Crystal and Ahn the handbook; their answers show up here." />
          ) : (
            FEEDBACK_AREAS.map((a) => {
              const list = others.filter((r) => r.area === a.key);
              if (!list.length) return null;
              const rated = list.filter((r) => r.rating);
              const avg = rated.length ? rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length : null;
              return (
                <div key={a.key} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                  <p className="flex items-center justify-between font-semibold">
                    {a.label}
                    {avg !== null ? (
                      <span className={avg < 3 ? "text-destructive" : "text-primary"}>{avg.toFixed(1)} / 5</span>
                    ) : null}
                  </p>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {list.map((r) => (
                      <li key={r.user_id} className="rounded-xl bg-secondary p-2.5">
                        <span className="font-semibold">
                          {people.get(r.user_id) ?? "Someone"}
                          {r.rating ? ` · ${r.rating}/5` : ""}
                        </span>
                        {r.works ? <span className="block">👍 {r.works}</span> : null}
                        {r.change ? <span className="block">✏️ {r.change}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          <h2 className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">My own notes</h2>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        {FEEDBACK_AREAS.map((a) => {
          const r = mine.get(a.key);
          return (
            <FeedbackForm
              key={a.key}
              area={a.key}
              label={a.label}
              ask={a.ask}
              saved={r ? { rating: r.rating, works: r.works, change: r.change } : null}
            />
          );
        })}
      </div>
    </>
  );
}
