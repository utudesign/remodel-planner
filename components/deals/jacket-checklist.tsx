import { CheckCircle2, Circle } from "lucide-react";
import { UploadButton } from "@/components/deals/upload-button";
import { GATE_LABEL } from "@/lib/deals/labels";

export type ChecklistRow = {
  requirement_id: string | null;
  gate: string | null;
  folder: string | null;
  label: string | null;
  required: boolean | null;
  satisfied: boolean | null;
  sort_order: number | null;
};

/** Jacket checklist by gate (DEALS.md §5). Each missing item has Add → files straight into its folder. */
export function JacketChecklist({ dealId, rows, canAdd }: { dealId: string; rows: ChecklistRow[]; canAdd: boolean }) {
  const gates = ["before_order", "before_start", "before_close"];
  return (
    <div className="flex flex-col gap-4">
      {gates.map((g) => {
        const items = rows.filter((r) => r.gate === g).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        if (!items.length) return null;
        const done = items.filter((i) => i.satisfied).length;
        return (
          <section key={g}>
            <h3 className="mb-1 flex items-center justify-between text-sm font-semibold">
              {GATE_LABEL[g]} <span className="text-xs font-normal text-muted-foreground">{done} of {items.length}</span>
            </h3>
            <ul className="flex flex-col divide-y">
              {items.map((i) => (
                <li key={i.requirement_id} className="flex min-h-12 items-center gap-2 py-1.5 text-sm">
                  {i.satisfied ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                  ) : (
                    <Circle className={i.required ? "size-5 shrink-0 text-destructive" : "size-5 shrink-0 text-muted-foreground"} />
                  )}
                  <span className="flex-1">
                    {i.label}
                    {!i.required ? <span className="text-xs text-muted-foreground"> (optional)</span> : null}
                  </span>
                  {!i.satisfied && canAdd && i.requirement_id && i.folder ? (
                    <UploadButton
                      dealId={dealId}
                      folder={i.folder}
                      requirementId={i.requirement_id}
                      photoTag={i.folder === "photos" ? (i.label?.toLowerCase().startsWith("after") ? "after" : "before") : undefined}
                      label="Add"
                      camera={i.folder === "photos"}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function checklistBadge(rows: ChecklistRow[], gate: string) {
  const items = rows.filter((r) => r.gate === gate && r.required);
  return { done: items.filter((i) => i.satisfied).length, total: items.length };
}
