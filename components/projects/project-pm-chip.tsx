"use client";

import { AssigneeChip } from "@/components/team/assignee-chip";
import { reassignProject } from "@/server/actions/projects";

export function ProjectPmChip({
  projectId,
  pm,
  people,
  disabled,
}: {
  projectId: string;
  pm: { id: string; name: string } | null;
  people: { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <AssigneeChip
      current={pm}
      people={people}
      label="PM"
      disabled={disabled}
      onAssign={(user_id) => reassignProject({ project_id: projectId, user_id })}
    />
  );
}
