import { redirect } from "next/navigation";

/** Partners were replaced by the Team page (0015). */
export default function PartnersPage() {
  redirect("/team");
}
