"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import {
  cancelInvite,
  giveOwnWorkspace,
  inviteTeammate,
  moveToWorkspace,
  renameWorkspace,
  setTeammateActive,
} from "@/server/actions/team";

export function InviteTeammateForm({
  trades = [],
  deals = [],
}: {
  trades?: { key: string; label: string }[];
  deals?: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(inviteTeammate, null);
  const [role, setRole] = useState<"team" | "crew" | "customer">("team");
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1" role="radiogroup" aria-label="Who">
        {(
          [
            ["team", "Team"],
            ["crew", "Worker"],
            ["customer", "Customer"],
          ] as const
        ).map(([k, label]) => (
          <label
            key={k}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold ${role === k ? "bg-card shadow-xs" : "text-muted-foreground"}`}
          >
            <input type="radio" name="role" value={k} checked={role === k} onChange={() => setRole(k)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      {role === "crew" ? (
        <Field label="Trade" htmlFor="t_trade">
          <select id="t_trade" name="trade_key" className="h-11 rounded-xl border bg-card px-3 text-base">
            {trades.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {role === "customer" ? (
        <Field label="Their job" htmlFor="t_deal">
          <select id="t_deal" name="deal_id" required className="h-11 rounded-xl border bg-card px-3 text-base">
            <option value="">Pick a sold deal…</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {role === "crew"
          ? "Workers see only the jobs they have tasks on: address, site rules, tasks, measurements, photos. Never prices or payments."
          : role === "customer"
            ? "Customers see only their own job: progress and schedule."
            : "Team members see every deal, estimate and job in this workspace."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" htmlFor="t_name">
          <Input id="t_name" name="name" placeholder="Ahn" />
        </Field>
        <Field label="Email" htmlFor="t_email">
          <Input id="t_email" name="email" type="email" placeholder="ahn@renodesign.com" required />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Invite to sign in</SubmitButton>
    </form>
  );
}

export function TeammateButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setTeammateActive({ id, active: !active });
          router.refresh();
        })
      }
      className="h-11 shrink-0 rounded-xl bg-secondary px-3 text-sm font-semibold disabled:opacity-60"
    >
      {active ? "Turn off" : "Turn on"}
    </button>
  );
}

export function CancelInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await cancelInvite({ id });
          router.refresh();
        })
      }
      className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-destructive disabled:opacity-60"
    >
      Cancel
    </button>
  );
}

/** Owner only: move a teammate into her own workspace (her own private board). */
export function GiveWorkspaceForm({ userId, defaultName }: { userId: string; defaultName: string }) {
  const [state, action] = useActionState(giveOwnWorkspace, null);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-3">
      <input type="hidden" name="user_id" value={userId} />
      <Field label="Her workspace name" htmlFor={`ws_${userId}`}>
        <Input id={`ws_${userId}`} name="name" defaultValue={defaultName} required />
      </Field>
      <p className="text-xs text-muted-foreground">
        She becomes its admin and starts with an empty board. You won&apos;t see her deals until she taps Share on one.
        Her deals in your workspace stay with you.
      </p>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Give her own workspace</SubmitButton>
    </form>
  );
}

export function RenameWorkspaceForm({ name }: { name: string }) {
  const [state, action] = useActionState(renameWorkspace, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label="Workspace name" htmlFor="ws_name" className="flex-1">
          <Input id="ws_name" name="name" defaultValue={name} required />
        </Field>
        <SubmitButton>Save</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** Owner only: move a teammate into an existing workspace as a member. */
export function MoveToWorkspaceForm({ userId, workspaces }: { userId: string; workspaces: { id: string; name: string }[] }) {
  const [state, action] = useActionState(moveToWorkspace, null);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-3">
      <input type="hidden" name="user_id" value={userId} />
      <Field label="Or move into" htmlFor={`mv_${userId}`}>
        <select id={`mv_${userId}`} name="workspace_id" className="h-11 rounded-xl border bg-card px-3 text-base">
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Move as a member</SubmitButton>
    </form>
  );
}
