/**
 * Add-by-code on the quick estimate: type "B36" and only B36 shows (then B36FH…).
 * "2 B36", "2xB36", "B36 x2" or "B36*2" add two. Words ("sink", "faucet") search names
 * when no code starts with what you typed.
 */
export type ItemQuery = { term: string; qty: number };

export function parseItemQuery(raw: string): ItemQuery {
  let t = raw.trim().replace(/\s+/g, " ");
  let qty = 1;
  const lead = t.match(/^(\d{1,3})\s*[x×*]?\s+(\S.*)$/i) ?? t.match(/^(\d{1,3})\s*[x×*]\s*(\S.*)$/i);
  const trail = t.match(/^(\S.*?)\s*[x×*]\s*(\d{1,3})$/i);
  if (lead) {
    qty = Number(lead[1]);
    t = lead[2];
  } else if (trail) {
    qty = Number(trail[2]);
    t = trail[1];
  }
  return { term: t.trim(), qty: Math.min(999, Math.max(1, qty || 1)) };
}

/** For a SQL LIKE pattern: escape the wildcards the user may type. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export type FoundItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  collection_id: string | null;
  price_cents: number;
  fixed: boolean;
};

/**
 * Best first: exact code → codes starting with it (shorter first, B36 before B36FH) → A–Z.
 * The same code in the estimate's collection beats the generic (no-collection) one.
 */
export function rankByCode(rows: FoundItem[], term: string, collectionId: string | null, limit = 6): FoundItem[] {
  const t = term.toUpperCase();
  const byCode = new Map<string, FoundItem>();
  for (const r of rows) {
    const key = r.code.toUpperCase();
    const prev = byCode.get(key);
    if (!prev || (collectionId && r.collection_id === collectionId && prev.collection_id !== collectionId)) byCode.set(key, r);
  }
  return [...byCode.values()]
    .filter((r) => r.code.toUpperCase().startsWith(t))
    .sort((a, b) => {
      const ae = a.code.toUpperCase() === t ? 0 : 1;
      const be = b.code.toUpperCase() === t ? 0 : 1;
      return ae - be || a.code.length - b.code.length || a.code.localeCompare(b.code);
    })
    .slice(0, limit);
}

export const isExact = (item: FoundItem | undefined, term: string) =>
  !!item && item.code.toUpperCase() === term.trim().toUpperCase();
