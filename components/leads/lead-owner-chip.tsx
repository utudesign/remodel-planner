"use client";

import { AssigneeChip } from "@/components/team/assignee-chip";
import { reassignLead } from "@/server/actions/leads";

export function LeadOwnerChip({
  leadId,
  owner,
  people,
}: {
  leadId: string;
  owner: { id: string; name: string } | null;
  people: { id: string; name: string }[];
}) {
  return (
    <AssigneeChip
      current={owner}
      people={people}
      label="Owner"
      onAssign={(owner_id) => reassignLead({ lead_id: leadId, owner_id })}
    />
  );
}
