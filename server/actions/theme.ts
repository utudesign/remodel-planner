"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Appearance per device (cookie): "dark" (Asana-style, default) or "light". */
export async function setTheme(theme: "dark" | "light") {
  const t = z.enum(["dark", "light"]).parse(theme);
  (await cookies()).set("theme", t, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
