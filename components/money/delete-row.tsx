"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMoneyRow } from "@/server/actions/money";

export function DeleteRow({ table, id }: { table: "business_expenses" | "mileage_trips" | "commission_payments"; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Delete"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this entry?")) start(() => deleteMoneyRow({ table, id }).then(() => undefined));
      }}
      className="flex size-10 items-center justify-center text-muted-foreground"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
