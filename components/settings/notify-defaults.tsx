"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveNotifyDefaults } from "@/server/actions/settings";

const ROLES = ["owner", "team", "crew"] as const;
const LABEL = { owner: "Owners", team: "Team", crew: "Crew" };

export function NotifyDefaults({
  kinds,
  value,
}: {
  kinds: { key: string; label: string; always: string }[];
  value: Record<string, string[]>;
}) {
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Event</th>
              {ROLES.map((r) => (
                <th key={r} className="px-2 py-1 text-center font-medium">
                  {LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.key} className="border-t">
                <td className="py-2">
                  {k.label}
                  <span className="block text-xs text-muted-foreground">Always: {k.always}</span>
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 text-center">
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={`${k.label}: ${LABEL[r]}`}
                      disabled={r === "crew" && (k.key === "money" || k.key === "new_deal")}
                      checked={(v[k.key] ?? []).includes(r)}
                      onChange={(e) =>
                        setV((cur) => {
                          const set = new Set(cur[k.key] ?? []);
                          if (e.target.checked) set.add(r);
                          else set.delete(r);
                          return { ...cur, [k.key]: [...set] };
                        })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveNotifyDefaults(v as Record<string, ("owner" | "team" | "crew")[]>);
            setMsg(r?.ok ? "Saved" : (r?.error ?? "Could not save"));
          })
        }
      >
        Save
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
