/**
 * Deal numbers: YY-NNNN, one series per company per year, starting at 1001.
 *   First deal of 2026 = "26-1001", next = "26-1002" … first deal of 2027 = "27-1001".
 * Why: short enough to say on the phone ("twenty-six ten forty-seven"), the year is visible,
 * sorts correctly as text, never collides, and doesn't depend on which day a deal was opened.
 * Documents inside a deal extend it: 26-1047-E2 (estimate v2), -D1 (vendor design request), -CO1 (change order),
 * -R3 (payment receipt), -PO1 (purchase order), -INV1 (invoice), -W1 (warranty claim).
 *
 * The database assigns numbers (next_deal_number + deals trigger; next_deal_doc_number).
 * This module formats, parses, labels and builds storage paths.
 */
export const DEAL_TZ = 'America/New_York';
export const DOC_KINDS = ['E', 'D', 'CO', 'R', 'PO', 'INV', 'W'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  E: 'Estimate', D: 'Design request', CO: 'Change order', R: 'Receipt', PO: 'Purchase order', INV: 'Invoice', W: 'Warranty claim',
};

/** Calendar year of an instant in the company's time zone (Dec 31 11:30 PM ET is still that year). */
export function dealYearAt(at: Date, timeZone = DEAL_TZ): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(at));
}

export function formatDealNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2099 || !Number.isInteger(seq) || seq < 1) {
    throw new RangeError(`invalid deal number parts ${year}#${seq}`);
  }
  return `${String(year % 100).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;
}

export function formatDocNumber(dealNumber: string, kind: DocKind, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`invalid document number ${n}`);
  return `${dealNumber}-${kind}${n}`;
}

export type ParsedDealNumber = { year?: number; seq: number; doc?: { kind: DocKind; n: number } };

/**
 * What people type in search: "26-1047", "#26-1047", "261047", "26 1047", "1047" (no year → current
 * year, decided by the caller), and document numbers "26-1047-CO2". Case-insensitive.
 */
export function parseDealNumber(input: string): ParsedDealNumber | null {
  const t = input.trim().toUpperCase().replace(/^#/, '');
  const m = t.match(/^(?:(\d{2})[\s-]?)?(\d{4,5})(?:-(E|D|CO|R|PO|INV|W)(\d+))?$/);
  if (!m) return null;
  const [, yy, s, kind, n] = m;
  const seq = Number(s);
  if (seq < 1) return null;
  return {
    ...(yy ? { year: 2000 + Number(yy) } : {}),
    seq,
    ...(kind ? { doc: { kind: kind as DocKind, n: Number(n) } } : {}),
  };
}

/** Display label: always "#26-1047" (the year is already in the number). */
export function dealLabel(dealNumber: string): string {
  return `#${dealNumber}`;
}

/** File/ZIP name: "26-1047 Lee kitchen". */
export function dealFileName(dealNumber: string, customerLastName: string, scope: string): string {
  return `${dealNumber} ${customerLastName} ${scope}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
}

/** Storage folders: {company}/{year}/{deal number}/{folder}/ */
export const DEAL_FOLDERS = [
  'photos', 'estimates', 'design', 'contract', 'permits', 'invoices_receipts',
  'payments', 'change_orders', 'warranty', 'other',
] as const;
export type DealFolder = (typeof DEAL_FOLDERS)[number];

export function dealStoragePath(companyId: string, dealYear: number, dealNumber: string, folder: DealFolder, fileName: string): string {
  const safe = fileName.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').toLowerCase();
  return `${companyId}/${dealYear}/${dealNumber}/${folder}/${crypto.randomUUID()}-${safe}`;
}
