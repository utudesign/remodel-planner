"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/server/action-utils";

export function SubmitButton({
  children,
  className,
  variant,
  size,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} size={size}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (!state.ok && state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return <p className="text-sm text-success">{state.message}</p>;
  }
  return null;
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** useActionState that runs `onSuccess` (e.g. close a dialog) when the action returns ok. */
export function useActionWithSuccess(
  fn: (prev: ActionState, fd: FormData) => Promise<ActionState>,
  onSuccess: (state: ActionState) => void,
) {
  return useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await fn(prev, fd);
    if (r?.ok) onSuccess(r);
    return r;
  }, null);
}
