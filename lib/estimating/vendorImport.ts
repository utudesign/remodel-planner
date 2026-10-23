/**
 * Vendor price list import (e.g. TimberPeak MSRP list, cost = MSRP x 0.33).
 *
 * Input: each sheet as a 2-D array of cell values (SheetJS `sheet_to_json(ws, { header: 1 })`
 * or ExcelJS rows). One sheet = one price group ("collection") of door colors.
 * Output: collections + items ready for the import_price_list() SQL function, plus warnings
 * the owner reviews before confirming (typos, prices that break the group pattern, missing SKUs).
 */
import { divRound } from './pricing';

export type ImportCategory = 'Cabinets' | 'Fillers & trim' | 'Cabinet accessories';

export interface SheetRows {
  name: string;
  rows: unknown[][];
}

export interface ImportOptions {
  vendor: string;            // "TimberPeak"
  costMultiplier: number;    // 0.33 = you pay 33% of MSRP
  patternTolerance?: number; // note group prices more than this far from the group's usual ratio (default 0.03)
  typoThreshold?: number;    // ...and call it a likely typo beyond this (default 0.6, i.e. 60% off the pattern)
}

export interface ImportedItem {
  code: string;
  description: string;
  unit: string;
  listPriceCents: number;
  costCents: number;
  category: ImportCategory;
}

export interface ImportedCollection {
  name: string;
  sheet: string;
  colors: string[];
  sortOrder: number;
  items: ImportedItem[];
}

export type WarningKind =
  | 'missing_header' | 'bad_price' | 'duplicate_code' | 'skipped_sample'
  | 'likely_typo' | 'off_pattern' | 'missing_in_group' | 'color_mismatch';

export interface ImportWarning {
  kind: WarningKind;
  sheet: string;
  code?: string;
  message: string;
}

const TRIM_RE = /filler|molding|moulding|panel|veneer|toe kick|kick|valanc|corbel|\bleg\b|touch up|spray paint/i;
const SAMPLE_RE = /\bsample\b/i;

function norm(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

export function categorize(description: string, color: string): ImportCategory {
  if (/^n\/?a$/i.test(color)) return 'Cabinet accessories';
  if (TRIM_RE.test(description)) return 'Fillers & trim';
  return 'Cabinets';
}

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === 'case') return 'ea';
  if (u === 'piece') return 'pc';
  return u || 'ea';
}

function splitColors(s: string): string[] {
  return s
    .replace(/\bN\/?A\b/gi, ' ')
    .split(/[\s,/]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function parsePriceList(sheets: SheetRows[], opts: ImportOptions) {
  const warnings: ImportWarning[] = [];
  const collections: ImportedCollection[] = [];
  const multBp = Math.round(opts.costMultiplier * 10000);
  if (multBp <= 0 || multBp > 15000) throw new RangeError(`cost multiplier out of range: ${opts.costMultiplier}`);
  const tolerance = opts.patternTolerance ?? 0.03;
  const typoThreshold = opts.typoThreshold ?? 0.6;

  sheets.forEach((sheet, sheetIndex) => {
    const headerIdx = sheet.rows.findIndex((r) => {
      const cells = r.map((c) => norm(c).toUpperCase());
      return cells.includes('NAME') && cells.includes('UNIT PRICE');
    });
    if (headerIdx < 0) {
      warnings.push({ kind: 'missing_header', sheet: sheet.name, message: 'No header row with NAME and UNIT PRICE; sheet skipped.' });
      return;
    }
    const header = sheet.rows[headerIdx]!.map((c) => norm(c).toUpperCase());
    const col = (label: string) => header.indexOf(label);
    const cCode = col('NAME'), cDesc = col('DESCRIPTION'), cUnit = col('UNITS TYPE'), cPrice = col('UNIT PRICE'), cColor = col('COLOR');

    const sheetColors = splitColors(sheet.name);
    // color codes printed in the header row after UNIT PRICE (e.g. "TSK", "TSC", "DBG")
    const headerColors = header.slice(cPrice + 1).flatMap((h) => splitColors(h));
    const columnColors = new Set<string>();
    const seen = new Set<string>();
    const items: ImportedItem[] = [];

    for (const row of sheet.rows.slice(headerIdx + 1)) {
      const code = norm(row[cCode]);
      if (!code) continue;
      const description = norm(row[cDesc]);
      const color = cColor >= 0 ? norm(row[cColor]) : '';
      splitColors(color).forEach((c) => columnColors.add(c));

      if (SAMPLE_RE.test(description)) {
        warnings.push({ kind: 'skipped_sample', sheet: sheet.name, code, message: `${code} is a sample, not imported.` });
        continue;
      }
      const raw = row[cPrice];
      const price = typeof raw === 'number' ? raw : Number(norm(raw).replace(/[$,]/g, ''));
      if (!Number.isFinite(price) || price <= 0) {
        warnings.push({ kind: 'bad_price', sheet: sheet.name, code, message: `${code} has no usable price (${norm(raw) || 'blank'}).` });
        continue;
      }
      if (seen.has(code)) {
        warnings.push({ kind: 'duplicate_code', sheet: sheet.name, code, message: `${code} appears more than once; first row kept.` });
        continue;
      }
      seen.add(code);
      const listPriceCents = Math.round(price * 100);
      items.push({
        code,
        description,
        unit: normalizeUnit(norm(row[cUnit])),
        listPriceCents,
        costCents: divRound(listPriceCents * multBp, 10000),
        category: categorize(description, color),
      });
    }

    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    const colColors = [...columnColors];
    for (const [label, other] of [['sheet name', sheetColors], ['header row', headerColors]] as const) {
      if (colColors.length && other.length && !sameSet(colColors, other)) {
        warnings.push({
          kind: 'color_mismatch', sheet: sheet.name,
          message: `The ${label} lists ${other.join('/')} but the COLOR column says ${colColors.join('/')}. Check with the vendor.`,
        });
      }
    }
    const colors = columnColors.size ? [...columnColors] : sheetColors;
    collections.push({
      name: `${opts.vendor} ${colors.join('/')}`,
      sheet: sheet.name,
      colors,
      sortOrder: sheetIndex + 1,
      items,
    });
  });

  // Cross-group checks against the first group (accessories are color-independent: skipped).
  const base = collections[0];
  if (base) {
    const baseByCode = new Map(base.items.map((i) => [i.code, i]));
    for (const c of collections.slice(1)) {
      const byCode = new Map(c.items.map((i) => [i.code, i]));
      for (const code of baseByCode.keys()) {
        if (!byCode.has(code)) {
          warnings.push({ kind: 'missing_in_group', sheet: c.sheet, code, message: `${code} is in ${base.sheet} but not in ${c.sheet}.` });
        }
      }
      const pairs = c.items
        .filter((i) => i.category !== 'Cabinet accessories' && baseByCode.has(i.code))
        .map((i) => ({ code: i.code, ratio: i.listPriceCents / baseByCode.get(i.code)!.listPriceCents }));
      if (!pairs.length) continue;
      const usual = median(pairs.map((p) => p.ratio));
      for (const p of pairs) {
        const dev = Math.abs(p.ratio / usual - 1);
        if (dev > tolerance) {
          const typo = dev > typoThreshold;
          warnings.push({
            kind: typo ? 'likely_typo' : 'off_pattern', sheet: c.sheet, code: p.code,
            message: `${p.code} is ${p.ratio.toFixed(2)}x the ${base.sheet} price; this group is usually ${usual.toFixed(2)}x.` +
              (typo ? ' Likely typo: confirm with the vendor before quoting.' : ''),
          });
        }
      }
    }
  }
  return { collections, warnings };
}

/** Shape expected by import_price_list(p_collections jsonb). */
export function toImportPayload(collections: ImportedCollection[]) {
  return collections.map((c) => ({
    name: c.name,
    colors: c.colors,
    sort_order: c.sortOrder,
    items: c.items.map((i) => ({
      code: i.code,
      description: i.description,
      unit: i.unit,
      list_price_cents: i.listPriceCents,
      cost_cents: i.costCents,
      category: i.category,
    })),
  }));
}
