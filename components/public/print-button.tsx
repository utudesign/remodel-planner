"use client";

import { Printer } from "lucide-react";

/** iPhone: Print → pinch out on the preview → Share → Save to Files / Messages = a PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-semibold print:hidden"
    >
      <Printer className="size-5" /> Save as PDF / print
    </button>
  );
}
