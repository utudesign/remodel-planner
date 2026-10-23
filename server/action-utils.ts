import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/auth/require-role";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Echo of an id the client may need (e.g. new project id). */
  id?: string;
} | null;

export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Turns anything thrown inside an action into a message a person can act on. */
export function friendlyError(e: unknown): string {
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const field = first?.path.join(".");
    return field
      ? `${field.replace(/_/g, " ")}: ${first.message}`
      : (first?.message ?? "Invalid input");
  }
  if (e instanceof ForbiddenError) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    // Postgres RAISE messages are written for people already (see 0003_rules.sql).
    return e.message.replace(/^Cannot close: /, "Can't close yet: ");
  }
  return "Something went wrong. Please try again.";
}

type SbResult = { data: unknown; error: { message: string } | null };

/** Supabase read that must return data: throws the DB error (or "Not found"). */
export function must<R extends SbResult>(res: R): NonNullable<R["data"]> {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null || res.data === undefined) throw new Error("Not found");
  return res.data as NonNullable<R["data"]>;
}

/** Supabase read that may legitimately return nothing (maybeSingle). */
export function maybe<R extends SbResult>(res: R): NonNullable<R["data"]> | null {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? null) as NonNullable<R["data"]> | null;
}

/** Supabase write without a returned row: throws the DB error, returns nothing. */
export function ok(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

export async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    // redirect()/notFound() must propagate
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest: unknown }).digest).startsWith("NEXT_")
    ) {
      throw e;
    }
    return { ok: false, error: friendlyError(e) };
  }
}
