"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveWorkWindows } from "@/server/actions/settings";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type W = {
  weekday: number;
  start_time: string;
  end_time: string;
  kind: "live" | "back_office" | "field";
};

/** One person's weekly windows, in Eastern Time. A window may run past midnight (e.g. 11 PM–3 AM). */
export function WorkWindowsEditor({
  userId,
  name,
  windows: initial,
}: {
  userId: string;
  name: string;
  windows: W[];
}) {
  const [rows, setRows] = useState<W[]>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const update = (i: number, patch: Partial<W>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function addWeekdays(kind: W["kind"], start: string, end: string) {
    setRows((r) => [
      ...r,
      ...[1, 2, 3, 4, 5].map((d) => ({ weekday: d, start_time: start, end_time: end, kind })),
    ]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="font-medium">{name}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No windows: never routed new leads.</p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {rows.map((w, i) => (
          <li key={i} className="grid grid-cols-[4.5rem_1fr_1fr_7rem_auto] items-center gap-1.5">
            <NativeSelect
              value={w.weekday}
              onChange={(e) => update(i, { weekday: Number(e.target.value) })}
              className="h-9 px-2"
              aria-label="Day"
            >
              {DAYS.map((d, n) => (
                <option key={d} value={n}>
                  {d}
                </option>
              ))}
            </NativeSelect>
            <Input
              type="time"
              value={w.start_time}
              onChange={(e) => update(i, { start_time: e.target.value })}
              className="h-9 px-2"
              aria-label="Start"
            />
            <Input
              type="time"
              value={w.end_time}
              onChange={(e) => update(i, { end_time: e.target.value })}
              className="h-9 px-2"
              aria-label="End"
            />
            <NativeSelect
              value={w.kind}
              onChange={(e) => update(i, { kind: e.target.value as W["kind"] })}
              className="h-9 px-2"
              aria-label="Kind"
            >
              <option value="live">Live</option>
              <option value="back_office">Back office</option>
              <option value="field">Field visits</option>
            </NativeSelect>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove"
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setRows((r) => [
              ...r,
              { weekday: 1, start_time: "09:00", end_time: "17:00", kind: "live" },
            ])
          }
        >
          <Plus /> Window
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addWeekdays("live", "11:00", "15:00")}
        >
          + Mon–Fri live 11–3
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addWeekdays("back_office", "23:00", "03:00")}
        >
          + Mon–Fri night 11–3
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveWorkWindows({
                user_id: userId,
                windows: rows.map((w) => ({
                  ...w,
                  start_time: w.start_time.slice(0, 5),
                  end_time: w.end_time.slice(0, 5),
                })),
              });
              setMsg({ ok: !!r?.ok, text: r?.ok ? "Saved" : (r?.error ?? "Could not save") });
            })
          }
        >
          Save
        </Button>
        {msg ? (
          <span
            className={
              msg.ok ? "self-center text-sm text-success" : "self-center text-sm text-destructive"
            }
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
