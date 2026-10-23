/** "@Crystal can you…" → ids of the people mentioned (first name or full name, case-insensitive). */
export function parseMentions(body: string, members: { id: string; name: string }[]): string[] {
  const text = ` ${body.toLowerCase()} `;
  const ids = new Set<string>();
  for (const m of members) {
    const full = m.name.trim().toLowerCase();
    if (!full) continue;
    const first = full.split(/\s+/)[0];
    for (const token of [full, first]) {
      const re = new RegExp(`@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
      if (re.test(text)) ids.add(m.id);
    }
  }
  return [...ids];
}
