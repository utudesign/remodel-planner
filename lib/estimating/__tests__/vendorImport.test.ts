import { describe, expect, it } from 'vitest';
import sheets from '../../../supabase/seed/timberpeak-msrp-sheets.json';
import { categorize, normalizeUnit, parsePriceList, toImportPayload, type SheetRows } from '../vendorImport';

const { collections, warnings } = parsePriceList(sheets as SheetRows[], { vendor: 'TimberPeak', costMultiplier: 0.33 });
const g1 = collections[0]!;
const find = (code: string, c = g1) => c.items.find((i) => i.code === code)!;

describe('TimberPeak MSRP list', () => {
  it('reads 4 color groups with their colors', () => {
    expect(collections.map((c) => c.colors.join('/'))).toEqual([
      'TSW/TSG/TSB/DBG', 'TSD/CDW/CTG/NSB', 'TSK/TSC/DCB', 'CWO',
    ]);
  });

  it('imports every SKU except the 2 samples', () => {
    for (const c of collections) expect(c.items).toHaveLength(279);
    expect(warnings.filter((w) => w.kind === 'skipped_sample').map((w) => w.code)).toContain('SD');
  });

  it('cost = MSRP x 0.33, in cents', () => {
    expect(find('SB36').listPriceCents).toBe(65268);
    expect(find('SB36').costCents).toBe(21538); // 652.68 x 0.33 = 215.3844
    expect(find('B15').costCents).toBe(14994);  // 454.36 x 0.33 = 149.9388
  });

  it('prices the 10x10 cabinet list at $3,076.92 cost in group 1', () => {
    const list: Record<string, number> = {
      BER36: 1, '3DB21': 1, SB36: 1, B15: 1, B36: 1, WDC2430: 1, W3330: 1, W2430: 1, W2730: 1, W3018: 1,
      W3630: 1, W362424: 1, BF3: 3, WF330: 3, 'REF2496-1.5': 1, WEDP30: 2, CM8: 4, LRM8: 3, TK8: 3, SM8: 2,
      OCM8: 1, TUK: 1,
    };
    const msrp = Object.entries(list).reduce((s, [code, q]) => s + find(code).listPriceCents * q, 0);
    expect(msrp).toBe(932400);
    const cost = Object.entries(list).reduce((s, [code, q]) => s + find(code).costCents * q, 0);
    expect(Math.abs(cost - 307692)).toBeLessThanOrEqual(10); // per-item rounding to the cent
  });

  it('sorts SKUs into cabinets, fillers & trim, accessories', () => {
    expect(find('W3018').category).toBe('Cabinets');
    expect(find('BF3').category).toBe('Fillers & trim');
    expect(find('LRM8').category).toBe('Fillers & trim');
    expect(find('REF2496-1.5').category).toBe('Fillers & trim');
    expect(find('TUK').category).toBe('Fillers & trim');
    expect(find('RT36').category).toBe('Cabinet accessories');
    expect(find('LS-Wood36').category).toBe('Cabinet accessories');
  });

  it('flags the likely typo: group 3 light rail at 0.28x group 1', () => {
    const g3 = collections[2]!;
    const typos = warnings.filter((w) => w.kind === 'likely_typo');
    expect(typos.map((w) => `${w.sheet}:${w.code}`)).toEqual([`${g3.sheet}:LRM8`]);
  });

  it('flags the DBG vs DCB color label mismatch on sheet 3', () => {
    expect(warnings.some((w) => w.kind === 'color_mismatch' && w.sheet === 'TSK,TSC DCB')).toBe(true);
  });

  it('builds the payload for import_price_list()', () => {
    const p = toImportPayload(collections);
    expect(p[0]!.items[0]).toEqual({
      code: 'B12', description: 'Base Cabinet - 12"W 34 1/2"H 24"D 1D, 1Drw, 1S', unit: 'ea',
      list_price_cents: 41144, cost_cents: 13578, category: 'Cabinets',
    });
  });
});

describe('helpers', () => {
  it('categorize', () => {
    expect(categorize('Toe Kick', 'TSW')).toBe('Fillers & trim');
    expect(categorize('Roll Out Tray', 'N/A')).toBe('Cabinet accessories');
    expect(categorize('Wall Cabinet - 30"W', 'TSW')).toBe('Cabinets');
  });
  it('units', () => {
    expect(normalizeUnit('Case')).toBe('ea');
    expect(normalizeUnit('case')).toBe('ea');
    expect(normalizeUnit('Piece')).toBe('pc');
    expect(normalizeUnit('Can')).toBe('can');
  });
  it('rejects a silly multiplier', () => {
    expect(() => parsePriceList([], { vendor: 'X', costMultiplier: 0 })).toThrow();
  });
  it('warns on a sheet with no header', () => {
    const r = parsePriceList([{ name: 'Bad', rows: [['foo', 'bar']] }], { vendor: 'X', costMultiplier: 0.33 });
    expect(r.collections).toHaveLength(0);
    expect(r.warnings[0]!.kind).toBe('missing_header');
  });
});
