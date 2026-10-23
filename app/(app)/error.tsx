"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ErrorState message={error.message || "Unexpected error."} />
      <Button variant="outline" className="w-fit" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
