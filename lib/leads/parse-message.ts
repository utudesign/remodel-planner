/**
 * Turns a pasted Facebook Marketplace / group message (or a text) into lead fields.
 * Regex rules only (no AI service): phone, a name, what they want, a town, and the source.
 * Everything it finds is a suggestion the rep can fix before saving.
 */
export type ParsedLead = {
  name: string | null;
  phone: string | null;
  email: string | null;
  scope: "kitchen" | "cabinets_only" | "countertops" | "bath" | null;
  city: string | null;
  source: "marketplace" | "fb_group" | null;
  notes: string;
};

/** Northern Virginia / DC-area towns people mention. */
const TOWNS = [
  "Alexandria", "Annandale", "Arlington", "Ashburn", "Bristow", "Burke", "Centreville", "Chantilly",
  "Clifton", "Dumfries", "Fairfax", "Fairfax Station", "Falls Church", "Gainesville", "Great Falls",
  "Haymarket", "Herndon", "Kingstowne", "Leesburg", "Lorton", "Manassas", "McLean", "Merrifield",
  "Oakton", "Reston", "Springfield", "Sterling", "Stafford", "Vienna", "Woodbridge", "Lake Ridge",
  "Fredericksburg", "Warrenton", "Purcellville", "Tysons", "Mount Vernon", "Franconia", "Washington",
  "Bethesda", "Rockville", "Silver Spring", "Gaithersburg",
];

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

export function formatPhone(raw: string): string | null {
  const m = raw.match(PHONE_RE);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : null;
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function findName(text: string): string | null {
  const patterns = [
    /\b(?:my name is|this is|i am|i'm|im)\s+([A-Za-z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?)/i,
    /^[-–—\s]*([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?)\s*$/m, // a sign-off line: "Maria G"
    /(?:thanks|thank you|regards|best)[,!.\s]+([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]*\.?)?)/i,
    /[.!?]\s+([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]*\.?)?)\s*$/, // "...call me 703-555-0102. Ahmed"
  ];
  const stop = /^(hi|hello|hey|thanks|thank|is|interested|kitchen|cabinets?|available|looking|still)$/i;
  for (const re of patterns) {
    const m = text.match(re);
    const name = m?.[1]?.trim().replace(/\.$/, "");
    if (name && !stop.test(name.split(/\s+/)[0]) && name.length <= 40) {
      const first = name.split(/\s+/)[0];
      if (/^(looking|interested|wondering|asking|trying|thinking|planning|ready|getting|in|at|from|on|a|the|not|just|so|very|also)$/i.test(first)) continue;
      return titleCase(name);
    }
  }
  return null;
}

function findScope(t: string): ParsedLead["scope"] {
  const s = t.toLowerCase();
  if (/\b(bath(room)?|vanity|shower)\b/.test(s) && !/kitchen/.test(s)) return "bath";
  if (/\b(full|whole|entire|complete|total)\s+(kitchen|remodel|renovation)|kitchen\s+(remodel|renovation|redo)|gut\b/.test(s)) return "kitchen";
  if (/\b(counter\s?tops?|quartz|granite)\b/.test(s) && !/\bcabinet/.test(s)) return "countertops";
  if (/\bcabinet(s|ry)?\b/.test(s)) return /\b(counter|quartz|granite|install|backsplash|sink)\b/.test(s) ? "kitchen" : "cabinets_only";
  if (/\bkitchen\b/.test(s)) return "kitchen";
  return null;
}

function findTown(t: string): string | null {
  for (const town of [...TOWNS].sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${town.replace(/ /g, "\\s+")}\\b`, "i").test(t)) return town;
  }
  return null;
}

function findSource(t: string): ParsedLead["source"] {
  const s = t.toLowerCase();
  if (/is this (still )?available|marketplace|listing/.test(s)) return "marketplace";
  if (/\bgroup\b|saw your post|your post in/.test(s)) return "fb_group";
  return null;
}

export function parseLeadMessage(text: string): ParsedLead {
  const t = text.replace(/\r/g, "").trim();
  return {
    name: findName(t),
    phone: formatPhone(t),
    email: t.match(EMAIL_RE)?.[0] ?? null,
    scope: findScope(t),
    city: findTown(t),
    source: findSource(t),
    notes: t,
  };
}
