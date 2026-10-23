import { OrganizationList } from "@clerk/nextjs";

export const metadata = { title: "Choose company" };

/** Every user must work inside an organization (org = the remodel company). */
export default function Page() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Pick your company, or create it if you&apos;re the owner. Teammates join by invitation.
      </p>
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/today"
        afterCreateOrganizationUrl="/today"
      />
    </div>
  );
}
