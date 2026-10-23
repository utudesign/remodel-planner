import { z } from "zod";
import { parseDollarsToCents } from "@/lib/money";

export const id = z.uuid({ message: "is missing" });

/** Optional text: "" → null. */
export const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const reqText = (max = 200) => z.string().trim().min(1, "is required").max(max);

/** "$12,400.50" → 1240050 cents; "" → null. */
export const optMoney = z
  .string()
  .optional()
  .transform((s, ctx) => {
    try {
      return parseDollarsToCents(s ?? "");
    } catch (e) {
      ctx.addIssue({ code: "custom", message: (e as Error).message });
      return z.NEVER;
    }
  });

export const reqMoney = optMoney.refine((v): v is number => v !== null && v > 0, {
  message: "enter an amount greater than $0",
});

/** "YYYY-MM-DD" or "" → null */
export const optDate = z
  .string()
  .optional()
  .transform((s) => (s ? s : null))
  .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "use YYYY-MM-DD");

export const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");

/** <input type="datetime-local"> value */
export const reqDateTimeLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "pick a date and time");
