import { redirect } from "next/navigation";

/** Money (the rep's commission) is gone in the one-company app (0015); the numbers live on KPIs. */
export default function MoneyPage() {
  redirect("/kpis");
}
