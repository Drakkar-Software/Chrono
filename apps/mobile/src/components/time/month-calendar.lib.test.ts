import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './month-calendar.lib';

describe('buildMonthGrid', () => {
  it('builds Monday-first weeks covering the whole month', () => {
    const grid = buildMonthGrid('2026-07');
    // July 2026: Wed 1st .. Fri 31st -> 5 Monday-first weeks (Jun 29 .. Aug 2).
    expect(grid.length).toBe(5);
    grid.forEach((week) => expect(week.length).toBe(7));
    expect(grid[0][0].date).toBe('2026-06-29');
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid[4][6].date).toBe('2026-08-02');
    expect(grid[4][6].inMonth).toBe(false);
  });

  it('marks every day within the target month as inMonth', () => {
    const grid = buildMonthGrid('2026-07');
    const flat = grid.flat();
    const inMonthDates = flat.filter((c) => c.inMonth).map((c) => c.date);
    expect(inMonthDates[0]).toBe('2026-07-01');
    expect(inMonthDates[inMonthDates.length - 1]).toBe('2026-07-31');
    expect(inMonthDates.length).toBe(31);
  });

  it('every row starts on a Monday', () => {
    const grid = buildMonthGrid('2026-07');
    for (const week of grid) {
      // 2026-06-29 and every 7th day after it is a Monday.
      const d = new Date(`${week[0].date}T00:00:00.000Z`);
      expect(d.getUTCDay()).toBe(1);
    }
  });

  it('handles a month that starts exactly on a Monday (no leading padding)', () => {
    // 2026-06-01 is a Monday.
    const grid = buildMonthGrid('2026-06');
    expect(grid[0][0].date).toBe('2026-06-01');
    expect(grid[0][0].inMonth).toBe(true);
  });

  it('handles a short month (February)', () => {
    const grid = buildMonthGrid('2026-02');
    const inMonthCount = grid.flat().filter((c) => c.inMonth).length;
    expect(inMonthCount).toBe(28);
  });
});
