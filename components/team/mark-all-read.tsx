"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/server/actions/comments";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => void (await markNotificationsRead()))}>
      <CheckCheck /> Mark all read
    </Button>
  );
}
