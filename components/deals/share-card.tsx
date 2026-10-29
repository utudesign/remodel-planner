"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setDealShared } from "@/server/actions/share";

type Ws = { id: string; name: string; shared: boolean };

/** Overview → Share (0016): only the deal's own workspace sees the buttons. */
export function ShareCard({ dealId, workspaces }: { dealId: string; workspaces: Ws[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toggle = (w: Ws) =>
    start(async () => {
      setError(null);
      const r = await setDealShared({ dealId, workspaceId: w.id, share: !w.shared });
      if (r && !r.ok) setError(r.error ?? "Could not change sharing");
      router.refresh();
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="size-4" /> Share
        </CardTitle>
        <CardDescription>
          Private to your workspace. Share it and the other workspace can see and edit everything on it. Stop sharing any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {workspaces.map((w) => (
            <li key={w.id} className="flex min-h-14 items-center gap-3 border-b border-border/60 py-1.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{w.name}</span>
                <span className="block text-xs text-muted-foreground">{w.shared ? "Can see and edit it" : "Can't see it"}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(w)}
                className={
                  w.shared
                    ? "h-11 shrink-0 rounded-xl bg-secondary px-4 text-sm font-semibold disabled:opacity-60"
                    : "h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                }
              >
                {w.shared ? "Stop sharing" : "Share"}
              </button>
            </li>
          ))}
        </ul>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
