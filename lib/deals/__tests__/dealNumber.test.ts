import { describe, expect, it } from 'vitest';
import { dealLabel, dealStoragePath, easternDate, formatDealNumber, parseDealNumber, previewDealNumber } from '../dealNumber';

describe('deal numbers', () => {
  it('formats MMDD + sequence', () => {
    expect(formatDealNumber(10, 23, 1)).toBe('10231');
    expect(formatDealNumber(10, 23, 2)).toBe('10232');
    expect(formatDealNumber(10, 24, 1)).toBe('10241');
    expect(formatDealNumber(10, 23, 10)).toBe('102310');
    expect(formatDealNumber(1, 5, 1)).toBe('01051');
  });

  it('never collides (date part is always 4 digits)', () => {
    expect(formatDealNumber(1, 12, 31)).toBe('011231');
    expect(formatDealNumber(11, 23, 1)).toBe('11231');
  });

  it('uses the Eastern Time date, not UTC', () => {
    // 11:30 PM Oct 23 in Virginia = 03:30 UTC Oct 24
    expect(previewDealNumber(new Date('2026-10-24T03:30:00Z'), 3)).toEqual({ year: 2026, number: '10233' });
    // New Year's Eve 11 PM ET is still the old year
    expect(easternDate(new Date('2027-01-01T04:00:00Z'))).toEqual({ year: 2026, month: 12, day: 31 });
    // across the Nov 1 DST change: 11:30 PM EST Nov 1 = 04:30 UTC Nov 2
    expect(previewDealNumber(new Date('2026-11-02T04:30:00Z'), 1).number).toBe('11011');
  });

  it('parses what people type in search', () => {
    expect(parseDealNumber('10231')).toEqual({ month: 10, day: 23, seq: 1 });
    expect(parseDealNumber('#102310')).toEqual({ month: 10, day: 23, seq: 10 });
    expect(parseDealNumber('2025-01051')).toEqual({ year: 2025, month: 1, day: 5, seq: 1 });
    expect(parseDealNumber('1023')).toBeNull();
    expect(parseDealNumber('13011')).toBeNull();
  });

  it('labels older years', () => {
    expect(dealLabel('10231', 2026, 2026)).toBe('#10231');
    expect(dealLabel('10231', 2025, 2026)).toBe('#10231 · 2025');
  });

  it('builds storage paths the database accepts', () => {
    const p = dealStoragePath('c1', 2026, '10231', 'photos', 'IMG 2041 (1).JPG');
    expect(p).toMatch(/^c1\/2026\/10231\/photos\/[0-9a-f-]{36}-img-2041-1-.jpg$/);
  });
});
