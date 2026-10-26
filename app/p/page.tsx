import { redirect } from "next/navigation";

/** Old partner home → Today (Crystal works in the main app since 0013). */
export default function PartnerHome() {
  redirect("/today");
}
