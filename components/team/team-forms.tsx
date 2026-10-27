"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { cancelInvite, inviteTeammate, setTeammateActive } from "@/server/actions/team";

export function InviteTeammateForm() {
  const [state, action] = useActionState(inviteTeammate, null);
  return (
    <form action={action} className="flex flex-col gap-3">
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
