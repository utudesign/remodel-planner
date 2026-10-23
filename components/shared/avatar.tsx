import { cn } from "@/lib/utils";

const COLORS = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-teal-600",
];

export function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function colorFor(id: string | null | undefined) {
  let h = 0;
  for (const c of id ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({
  id,
  name,
  className,
}: {
  id?: string | null;
  name?: string | null;
  className?: string;
}) {
  return (
    <span
      title={name ?? "Unassigned"}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
        id ? colorFor(id) : "bg-muted-foreground/40",
        className,
      )}
    >
      {id ? initials(name) : "?"}
    </span>
  );
}
