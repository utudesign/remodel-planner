import { describe, expect, it } from 'vitest';
import {
  dealFileName, dealLabel, dealStoragePath, dealYearAt, formatDealNumber, formatDocNumber, parseDealNumber,
} from '../dealNumber';

describe('deal numbers (YY-NNNN)', () => {
  it('formats year + 4-digit sequence', () => {
    expect(formatDealNumber(2026, 1001)).toBe('26-1001');
    expect(formatDealNumber(2026, 1047)).toBe('26-1047');
    expect(formatDealNumber(2027, 1001)).toBe('27-1001');
    expect(formatDealNumber(2026, 7)).toBe('26-0007'); // custom start below 1000 still sorts
    expect(formatDealNumber(2026, 10001)).toBe('26-10001');
    expect(() => formatDealNumber(2026, 0)).toThrow(RangeError);
  });

  it('matches the database for the same inputs', () => {
    // run_deal_tests.sql: first deals of 2026 → 26-1001…, Jan 1 2027 → 27-1001
    expect(['26-1001', '26-1002', '27-1001']).toEqual([formatDealNumber(2026, 1001), formatDealNumber(2026, 1002), formatDealNumber(2027, 1001)]);
  });

  it('sorts as text in creation order', () => {
    const nums = [formatDealNumber(2027, 1001), formatDealNumber(2026, 1010), formatDealNumber(2026, 1002)];
    expect([...nums].sort()).toEqual(['26-1002', '26-1010', '27-1001']);
  });

  it('uses the Eastern year, not UTC', () => {
    // 11:30 PM Dec 31 in Virginia = 04:30 UTC Jan 1
    expect(dealYearAt(new Date('2027-01-01T04:30:00Z'))).toBe(2026);
    expect(dealYearAt(new Date('2027-01-01T05:10:00Z'))).toBe(2027);
  });

  it('builds document numbers', () => {
    expect(formatDocNumber('26-1047', 'CO', 2)).toBe('26-1047-CO2');
    expect(formatDocNumber('26-1047', 'E', 1)).toBe('26-1047-E1');
    expect(parseDealNumber('26-1047-D1')?.doc).toEqual({ kind: 'D', n: 1 });
  });

  it('parses what people type in search', () => {
    expect(parseDealNumber('26-1047')).toEqual({ year: 2026, seq: 1047 });
    expect(parseDealNumber('#26-1047')).toEqual({ year: 2026, seq: 1047 });
    expect(parseDealNumber('261047')).toEqual({ year: 2026, seq: 1047 });
    expect(parseDealNumber('26 1047')).toEqual({ year: 2026, seq: 1047 });
    expect(parseDealNumber('1047')).toEqual({ seq: 1047 });
    expect(parseDealNumber('26-1047-co2')).toEqual({ year: 2026, seq: 1047, doc: { kind: 'CO', n: 2 } });
    expect(parseDealNumber('Lee')).toBeNull();
    expect(parseDealNumber('47')).toBeNull();
  });

  it('labels and names files', () => {
    expect(dealLabel('26-1047')).toBe('#26-1047');
    expect(dealFileName('26-1047', 'Lee', 'kitchen')).toBe('26-1047 Lee kitchen');
  });

  it('builds storage paths the database accepts', () => {
    const p = dealStoragePath('c1', 2026, '26-1047', 'photos', 'IMG 2041 (1).JPG');
    expect(p).toMatch(/^c1\/2026\/26-1047\/photos\/[0-9a-f-]{36}-img-2041-1-.jpg$/);
  });
});
