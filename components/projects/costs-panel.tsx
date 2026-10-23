"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Field, FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { centsToInput, formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteCost, saveCost } from "@/server/actions/work";

type Cost = {
  id: string;
  category_id: string;
  vendor: string | null;
  description: string | null;
  estimated_amount_cents: number;
  actual_amount_cents: number | null;
  paid_on: string | null;
  category: { label: string; sort_order: number } | null;
};

export function CostsPanel({
  projectId,
  costs,
  categories,
  canEdit,
}: {
  projectId: string;
  costs: Cost[];
  categories: { id: string; label: string; sort_order: number }[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = categories
    .map((c) => ({ ...c, items: costs.filter((x) => x.category_id === c.id) }))
    .filter((g) => g.items.length);
  const missing = costs.filter((c) => c.actual_amount_cents === null).length;

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState message={error} /> : null}
      {missing > 0 ? (
        <p className="text-sm text-muted-foreground">
          {missing} line{missing === 1 ? "" : "s"} still need an actual amount before the project
          can close.
        </p>
      ) : null}
      {groups.length === 0 ? (
        <EmptyState
          title="No costs yet"
          description="Add the estimate per bucket now; fill actuals as bills come in."
        />
      ) : (
        groups.map((g) => {
          const est = g.items.reduce((s, x) => s + x.estimated_amount_cents, 0);
          const act = g.items.reduce((s, x) => s + (x.actual_amount_cents ?? 0), 0);
          const done = g.items.every((x) => x.actual_amount_cents !== null);
          const over = done && act > est;
          return (
            <section key={g.id} className="rounded-xl border bg-card p-3">
              <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{g.label}</h3>
                <p className="text-xs tabular-nums text-muted-foreground">
                  est {formatCents(est)} · actual{" "}
                  <span className={cn(over && "font-semibold text-destructive")}>
                    {formatCents(act)}
                  </span>
                  {over ? ` (+${formatCents(act - est)})` : ""}
                </p>
              </header>
              <ul className="flex flex-col divide-y">
                {g.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{c.description || c.vendor || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.vendor && c.description ? c.vendor : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs tabular-nums">
                        <p className="text-muted-foreground">
                          est {formatCents(c.estimated_amount_cents)}
                        </p>
                        {c.actual_amount_cents === null ? (
                          <Badge variant="warning">No actual</Badge>
                        ) : (
                          <p className="font-medium">{formatCents(c.actual_amount_cents)}</p>
                        )}
                      </div>
                      {canEdit ? (
                        <>
                          <CostDialog projectId={projectId} cost={c} categories={categories} />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete cost"
                            disabled={pending}
                            onClick={() => {
                              if (!confirm("Delete this cost line?")) return;
                              start(async () => {
                                const r = await deleteCost({ cost_id: c.id });
                                if (!r?.ok) setError(r?.error ?? "Could not delete");
                              });
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {canEdit ? (
        <div>
          <CostDialog projectId={projectId} categories={categories} />
        </div>
      ) : null}
    </div>
  );
}

function CostDialog({
  projectId,
  cost,
  categories,
}: {
  projectId: string;
  cost?: Cost;
  categories: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionWithSuccess(saveCost, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {cost ? (
          <Button size="icon" variant="ghost" aria-label="Edit cost">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus /> Cost line
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cost ? "Edit cost" : "Add cost"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="cost_id" value={cost?.id ?? ""} />
          <Field label="Bucket" htmlFor="category_id" className="col-span-2">
            <NativeSelect
              id="category_id"
              name="category_id"
              defaultValue={cost?.category_id ?? categories[0]?.id}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="What" htmlFor="description">
            <Input
              id="description"
              name="description"
              defaultValue={cost?.description ?? ""}
              placeholder="Shaker cabinets"
            />
          </Field>
          <Field label="Vendor" htmlFor="vendor">
            <Input id="vendor" name="vendor" defaultValue={cost?.vendor ?? ""} />
          </Field>
          <Field label="Estimated ($)" htmlFor="estimated">
            <Input
              id="estimated"
              name="estimated"
              inputMode="decimal"
              defaultValue={centsToInput(cost?.estimated_amount_cents)}
            />
          </Field>
          <Field label="Actual ($)" htmlFor="actual" hint="Leave blank until the bill arrives">
            <Input
              id="actual"
              name="actual"
              inputMode="decimal"
              defaultValue={centsToInput(cost?.actual_amount_cents)}
            />
          </Field>
          <Field label="Paid on" htmlFor="paid_on" className="col-span-2">
            <Input id="paid_on" name="paid_on" type="date" defaultValue={cost?.paid_on ?? ""} />
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
