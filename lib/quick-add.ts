/**
 * Quick-add (FIELD-AND-OFFICE §8): paste a Marketplace / text / email message and pre-fill a lead.
 * Heuristics only — the person checks the form before saving.
 */
export type QuickAddGuess = {
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string;
};

const PHONE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const NAME_LABEL = /^\s*(?:name|from|sender)\s*[:\-]\s*(.+)$/im;
const LOOKS_LIKE_NAME = /^[A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,2}$/;
const NOT_NAMES = new Set([
  "Hi",
  "Hello",
  "Hey",
  "Is",
  "Thanks",
  "Thank",
  "Marketplace",
  "Facebook",
  "Yes",
  "Good",
]);

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

export function parseQuickAdd(text: string): QuickAddGuess {
  const notes = text.trim();
  const phoneMatch = PHONE.exec(notes);
  const email = EMAIL.exec(notes)?.[0] ?? null;
  let name: string | null = NAME_LABEL.exec(notes)?.[1]?.trim() ?? null;
  if (!name) {
    const first =
      notes
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean) ?? "";
    if (LOOKS_LIKE_NAME.test(first) && !NOT_NAMES.has(first.split(/\s+/)[0])) name = first;
  }
  if (name) name = name.replace(/[,.:;]+$/, "").slice(0, 120);
  return {
    name,
    phone: phoneMatch ? formatPhone(phoneMatch[0]) : null,
    email,
    notes,
  };
}
