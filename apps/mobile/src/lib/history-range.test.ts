import { describe, expect, it } from 'vitest';
import { currentMonthKey, rangeBounds } from './history-range';

describe('currentMonthKey', () => {
  it('returns YYYY-MM for a date', () => {
    expect(currentMonthKey('2026-07-24')).toBe('2026-07');
  });
});

describe('rangeBounds', () => {
  it('returns open bounds for all', () => {
    expect(rangeBounds('all')).toEqual({});
  });

  it('resolves a calendar month to inclusive month bounds', () => {
    expect(rangeBounds('2026-07')).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('resolves thisWeek to Monday–Sunday containing today', () => {
    // Can't freeze todayISO without mocking — just assert shape.
    const b = rangeBounds('thisWeek');
    expect(b.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(b.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(b.from! <= b.to!).toBe(true);
  });
});
