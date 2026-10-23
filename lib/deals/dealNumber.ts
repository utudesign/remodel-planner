/**
 * Deal numbers: MMDD (Eastern Time) + that day's sequence. Restarts every year.
 *   Oct 23 1st = "10231", 2nd = "10232", 10th = "102310"; Oct 24 1st = "10241"; Jan 5 1st = "01051"
 * The database assigns numbers (next_deal_number + deals trigger). This module only formats,
 * parses and previews them, using the same Eastern-Time date rule.
 */
export const DEAL_TZ = 'America/New_York';

/** Calendar date of an instant in Eastern Time, as { year, month, day }. */
export function easternDate(at: Date, timeZone = DEAL_TZ): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function formatDealNumber(month: number, day: number, seq: number): string {
  if (month < 1 || month > 12 || day < 1 || day > 31 || seq < 1 || !Number.isInteger(seq)) {
    throw new RangeError(`invalid deal number parts ${month}/${day}#${seq}`);
  }
  return `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${seq}`;
}

/** What number a deal opened at `at` would get if it is the `seq`-th of its Eastern day. */
export function previewDealNumber(at: Date, seq: number, timeZone = DEAL_TZ): { year: number; number: string } {
  const d = easternDate(at, timeZone);
  return { year: d.year, number: formatDealNumber(d.month, d.day, seq) };
}

/** "10231" → { month: 10, day: 23, seq: 1 }. Accepts "#10231" and "2026-10231". */
export function parseDealNumber(input: string): { year?: number; month: number; day: number; seq: number } | null {
  const m = input.trim().replace(/^#/, '').match(/^(?:(\d{4})-)?(\d{2})(\d{2})(\d+)$/);
  if (!m) return null;
  const [, y, mm, dd, s] = m;
  const month = Number(mm), day = Number(dd), seq = Number(s);
  if (month < 1 || month > 12 || day < 1 || day > 31 || seq < 1) return null;
  return { ...(y ? { year: Number(y) } : {}), month, day, seq };
}

/** Display: "#10231"; add the year when it is not the current one ("#10231 · 2025"). */
export function dealLabel(dealNumber: string, dealYear: number, currentYear: number): string {
  return dealYear === currentYear ? `#${dealNumber}` : `#${dealNumber} · ${dealYear}`;
}

/** Storage folder for a deal's files: {company}/{year}/{deal number}/{folder}/ */
export const DEAL_FOLDERS = [
  'photos', 'estimates', 'design', 'contract', 'permits', 'invoices_receipts',
  'payments', 'change_orders', 'warranty', 'other',
] as const;
export type DealFolder = (typeof DEAL_FOLDERS)[number];

export function dealStoragePath(companyId: string, dealYear: number, dealNumber: string, folder: DealFolder, fileName: string): string {
  const safe = fileName.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').toLowerCase();
  return `${companyId}/${dealYear}/${dealNumber}/${folder}/${crypto.randomUUID()}-${safe}`;
}
