import { describe, expect, it } from 'vitest';
import { fullDayOffDatesInMonth, partialOffMinutesByDate, timeOffDaysInMonth } from './time-off.lib';

const MON_FRI = [1, 2, 3, 4, 5];
const HOURS_PER_DAY = 7;

function off(overrides: Partial<{ off_date: string; duration_minutes: number | null }> = {}) {
  return { off_date: '2026-07-15', duration_minutes: null, ...overrides };
}

describe('timeOffDaysInMonth', () => {
  it('counts a full-day off as 1', () => {
    const total = timeOffDaysInMonth([off()], '2026-07', MON_FRI, [], HOURS_PER_DAY);
    expect(total).toBe(1);
  });

  it('converts a partial off to a fraction of the day', () => {
    // 2026-07-15 is a Wednesday; 3.5h off at a 7h day = 0.5 day.
    const total = timeOffDaysInMonth(
      [off({ duration_minutes: 210 })],
      '2026-07',
      MON_FRI,
      [],
      HOURS_PER_DAY,
    );
    expect(total).toBe(0.5);
  });

  it('is 0 for a full day off on a weekend (not a business day to begin with)', () => {
    // 2026-07-18 is a Saturday.
    const total = timeOffDaysInMonth(
      [off({ off_date: '2026-07-18' })],
      '2026-07',
      MON_FRI,
      [],
      HOURS_PER_DAY,
    );
    expect(total).toBe(0);
  });

  it('is 0 for time off on a date already excluded as a company holiday', () => {
    const total = timeOffDaysInMonth(
      [off({ off_date: '2026-07-14' })],
      '2026-07',
      MON_FRI,
      ['2026-07-14'],
      HOURS_PER_DAY,
    );
    expect(total).toBe(0);
  });

  it('sums multiple time-off entries within the month', () => {
    const total = timeOffDaysInMonth(
      [off({ off_date: '2026-07-06' }), off({ off_date: '2026-07-07', duration_minutes: 210 })],
      '2026-07',
      MON_FRI,
      [],
      HOURS_PER_DAY,
    );
    expect(total).toBe(1.5);
  });

  it('ignores entries outside the target month', () => {
    const total = timeOffDaysInMonth([off({ off_date: '2026-08-01' })], '2026-07', MON_FRI, [], HOURS_PER_DAY);
    expect(total).toBe(0);
  });

  it('is 0 for an empty list', () => {
    expect(timeOffDaysInMonth([], '2026-07', MON_FRI, [], HOURS_PER_DAY)).toBe(0);
  });

  it('is 0 for a partial off when hoursPerDay is invalid', () => {
    const total = timeOffDaysInMonth(
      [off({ duration_minutes: 210 })],
      '2026-07',
      MON_FRI,
      [],
      0,
    );
    expect(total).toBe(0);
  });
});

describe('fullDayOffDatesInMonth', () => {
  it('returns only full-day dates within the month', () => {
    const dates = fullDayOffDatesInMonth(
      [
        off({ off_date: '2026-07-06' }),
        off({ off_date: '2026-07-07', duration_minutes: 210 }),
        off({ off_date: '2026-08-01' }),
      ],
      '2026-07',
    );
    expect(dates).toEqual(['2026-07-06']);
  });

  it('is empty when there are no full-day entries', () => {
    expect(fullDayOffDatesInMonth([], '2026-07')).toEqual([]);
  });
});

describe('partialOffMinutesByDate', () => {
  it('maps partial-off dates to their minutes within the month', () => {
    const map = partialOffMinutesByDate(
      [
        off({ off_date: '2026-07-06' }),
        off({ off_date: '2026-07-07', duration_minutes: 210 }),
        off({ off_date: '2026-08-01', duration_minutes: 60 }),
      ],
      '2026-07',
    );
    expect(map).toEqual({ '2026-07-07': 210 });
  });

  it('is empty when there are no partial entries', () => {
    expect(partialOffMinutesByDate([], '2026-07')).toEqual({});
  });
});
