"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmMeeting } from "@/server/actions/command";

export function ConfirmButton({ meetingId }: { meetingId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      className="h-11"
      disabled={pending || done}
      onClick={() =>
        start(async () => setDone(!!(await confirmMeeting({ meeting_id: meetingId }))?.ok))
      }
    >
      {done ? "Queued for 9 AM" : "Queue confirmation"}
    </Button>
  );
}
