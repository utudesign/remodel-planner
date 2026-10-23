import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotifyDefaults } from "@/components/settings/notify-defaults";
import { RulesForm } from "@/components/settings/rules-form";
import { WorkWindowsEditor } from "@/components/settings/work-windows-editor";
import { requirePageRole } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";
import { getTeam } from "@/server/queries/settings";

export const metadata = { title: "Routing & alerts" };

// Defaults mirror private.notify_roles() in 0004.
const KINDS = [
  { key: "new_lead", label: "New lead", always: "lead owner", def: ["team"] },
  { key: "money", label: "Deposit / payment received", always: "—", def: ["owner", "team"] },
  { key: "meeting", label: "Meeting booked or moved", always: "—", def: ["owner"] },
  { key: "blocked", label: "Task blocked", always: "job PM", def: [] as string[] },
  { key: "assigned", label: "Lead reassigned", always: "new owner", def: [] as string[] },
];

export default async function RoutingSettingsPage() {
  const s = await requirePageRole("owner");
  const [team, windows] = await Promise.all([
    getTeam(s),
    s.db
      .from("work_windows")
      .select("user_id, weekday, start_time, end_time, kind")
      .order("weekday"),
  ]);
  const ws = must(windows);
  const raw = s.settings.raw;
  const notify = (raw.notify ?? {}) as Record<string, string[]>;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Work windows (Eastern Time)</CardTitle>
          <CardDescription>
            New leads go to whoever is in a <b>Live</b> window; otherwise to the default owner,
            flagged &ldquo;waiting for live shift&rdquo;. <b>Field</b> windows are when home visits
            can be booked. Times are ET, so the admin&apos;s Manila clock moves by an hour on Nov 1
            and in March.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">
          {team
            .filter((u) => u.active && u.role !== "crew")
            .map((u) => (
              <WorkWindowsEditor
                key={u.id}
                userId={u.id}
                name={u.name || u.email || "—"}
                windows={ws
                  .filter((w) => w.user_id === u.id)
                  .map((w) => ({
                    weekday: w.weekday,
                    start_time: w.start_time.slice(0, 5),
                    end_time: w.end_time.slice(0, 5),
                    kind: w.kind as "live" | "back_office" | "field",
                  }))}
              />
            ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quiet hours &amp; clocks</CardTitle>
          <CardDescription>
            Client messages written in quiet hours are saved for the end of quiet hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RulesForm
            values={{
              quiet_hours_start: s.rules.quietStart,
              quiet_hours_end: s.rules.quietEnd,
              lead_response_minutes: s.rules.responseMinutes,
              design_due_days: s.settings.designDueDays,
              visit_buffer_minutes:
                typeof raw.visit_buffer_minutes === "number" ? raw.visit_buffer_minutes : 30,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notification defaults</CardTitle>
          <CardDescription>
            Who gets a push for each event. @mentions and replies always notify the people involved.
            Each person can mute kinds in More → Notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotifyDefaults
            kinds={KINDS}
            value={Object.fromEntries(KINDS.map((k) => [k.key, notify[k.key] ?? k.def]))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
