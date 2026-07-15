import { describe, expect, it } from 'vitest';
import {
  computeEarnedCents,
  formatDuration,
  minutesToDays,
  sumDurations,
  weekBounds,
  monthBounds,
  monthKey,
  groupByDay,
  summarizeByProject,
  yearBounds,
} from './time-entry.lib';

describe('minutesToDays', () => {
  it('converts minutes to fractional days at a 7h day', () => {
    expect(minutesToDays(420, 7)).toBe(1); // 7h = 1 day
    expect(minutesToDays(210, 7)).toBe(0.5);
  });

  it('returns 0 for a non-positive working day', () => {
    expect(minutesToDays(420, 0)).toBe(0);
    // Negative hours-per-day also hits the <=0 guard.
    expect(minutesToDays(420, -7)).toBe(0);
  });

  it('carries a negative sign through for negative minutes', () => {
    expect(minutesToDays(-420, 7)).toBe(-1);
  });
});

describe('computeEarnedCents', () => {
  it('matches the DB RPC: round(minutes/(hpd*60) * tjm)', () => {
    // 1 full day at a 50000-cent day rate.
    expect(computeEarnedCents(420, 7, 50000)).toBe(50000);
    // Half a day.
    expect(computeEarnedCents(210, 7, 50000)).toBe(25000);
  });

  it('rounds to whole cents', () => {
    // 100 minutes / (7*60) = 0.238095... * 50000 = 11904.76 -> 11905
    expect(computeEarnedCents(100, 7, 50000)).toBe(11905);
  });

  it('is zero for zero minutes', () => {
    expect(computeEarnedCents(0, 7, 50000)).toBe(0);
  });

  it('is negative for negative minutes', () => {
    // -1 full day at 50000/day.
    expect(computeEarnedCents(-420, 7, 50000)).toBe(-50000);
  });

  it('is 0 when the working day is <= 0 (guard short-circuits)', () => {
    expect(computeEarnedCents(420, 0, 50000)).toBe(0);
    expect(computeEarnedCents(420, -7, 50000)).toBe(0);
  });

  it('rounds a half-cent boundary up (Math.round is half-up)', () => {
    // 1h day (60 min). 30 min = 0.5 day.
    // 0.5 * 1 = 0.5 -> 1
    expect(computeEarnedCents(30, 1, 1)).toBe(1);
    // 0.5 * 5 = 2.5 -> 3
    expect(computeEarnedCents(30, 1, 5)).toBe(3);
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(450)).toBe('7h 30m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('sumDurations', () => {
  it('sums duration_minutes', () => {
    expect(
      sumDurations([
        { duration_minutes: 60 },
        { duration_minutes: 90 },
        { duration_minutes: 30 },
      ]),
    ).toBe(180);
    expect(sumDurations([])).toBe(0);
  });
});

describe('weekBounds', () => {
  it('is Monday-based', () => {
    // 2026-07-14 is a Tuesday -> week Mon 2026-07-13 .. Sun 2026-07-19
    expect(weekBounds('2026-07-14')).toEqual({
      start: '2026-07-13',
      end: '2026-07-19',
    });
  });

  it('keeps a Monday as its own week start', () => {
    expect(weekBounds('2026-07-13').start).toBe('2026-07-13');
  });

  it('treats Sunday as the end of the prior Monday week', () => {
    expect(weekBounds('2026-07-19')).toEqual({
      start: '2026-07-13',
      end: '2026-07-19',
    });
  });
});

describe('monthBounds / monthKey', () => {
  it('bounds a calendar month', () => {
    expect(monthBounds('2026-07-14')).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
    // February in a non-leap year
    expect(monthBounds('2026-02-10').end).toBe('2026-02-28');
  });

  it('normalizes to the first of the month', () => {
    expect(monthKey('2026-07-14')).toBe('2026-07-01');
  });

  it('bounds December correctly', () => {
    expect(monthBounds('2026-12-10')).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    });
  });

  it('bounds a leap-year February to the 29th', () => {
    expect(monthBounds('2028-02-15')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });
});

describe('weekBounds across a year boundary', () => {
  it('spans from December into the next January', () => {
    // 2025-12-31 is a Wednesday -> Mon 2025-12-29 .. Sun 2026-01-04
    expect(weekBounds('2025-12-31')).toEqual({
      start: '2025-12-29',
      end: '2026-01-04',
    });
  });
});

describe('yearBounds', () => {
  it('bounds a calendar year', () => {
    expect(yearBounds('2026-07-14')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('bounds correctly from any date in the year', () => {
    expect(yearBounds('2026-01-01')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(yearBounds('2026-12-31')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('grouping', () => {
  it('groups by day and summarizes by project', () => {
    const entries = [
      { entry_date: '2026-07-13', project_id: 'a', duration_minutes: 60 },
      { entry_date: '2026-07-13', project_id: 'b', duration_minutes: 30 },
      { entry_date: '2026-07-14', project_id: 'a', duration_minutes: 90 },
    ];
    expect(Object.keys(groupByDay(entries))).toEqual([
      '2026-07-13',
      '2026-07-14',
    ]);
    expect(summarizeByProject(entries)).toEqual({
      a: { minutes: 150, count: 2 },
      b: { minutes: 30, count: 1 },
    });
  });
});
