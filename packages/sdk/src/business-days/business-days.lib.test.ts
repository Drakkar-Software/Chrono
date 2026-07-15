import { describe, expect, it } from 'vitest';
import {
  businessDaysInMonth,
  businessDaysRemaining,
  exceedsBusinessDayCap,
  isBusinessDay,
  isHoliday,
  isoWeekday,
  remainingDayBudget,
  resolveWorkingWeekdays,
} from './business-days.lib';

const MON_FRI = [1, 2, 3, 4, 5];

describe('isoWeekday', () => {
  it('maps 1=Monday .. 7=Sunday', () => {
    expect(isoWeekday('2026-07-01')).toBe(3); // Wednesday
    expect(isoWeekday('2026-07-04')).toBe(6); // Saturday
    expect(isoWeekday('2026-07-05')).toBe(7); // Sunday
    expect(isoWeekday('2026-07-06')).toBe(1); // Monday
  });
});

describe('resolveWorkingWeekdays', () => {
  it('uses the company default when no member override is set', () => {
    expect(resolveWorkingWeekdays(MON_FRI, undefined)).toEqual(MON_FRI);
    expect(resolveWorkingWeekdays(MON_FRI, null)).toEqual(MON_FRI);
  });

  it('uses the member override when set, even if narrower or wider', () => {
    expect(resolveWorkingWeekdays(MON_FRI, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(resolveWorkingWeekdays(MON_FRI, [1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('honors an explicit empty override (zero working days)', () => {
    expect(resolveWorkingWeekdays(MON_FRI, [])).toEqual([]);
  });
});

describe('isHoliday', () => {
  it('matches on the date part regardless of time component', () => {
    expect(isHoliday('2026-07-14', ['2026-07-14'])).toBe(true);
    expect(isHoliday('2026-07-14T10:00:00.000Z', ['2026-07-14'])).toBe(true);
    expect(isHoliday('2026-07-15', ['2026-07-14'])).toBe(false);
  });

  it('is false for an empty holiday list', () => {
    expect(isHoliday('2026-07-14', [])).toBe(false);
  });
});

describe('isBusinessDay', () => {
  it('is true for a working weekday with no holiday', () => {
    expect(isBusinessDay('2026-07-01', MON_FRI)).toBe(true); // Wednesday
  });

  it('is false for a weekend day', () => {
    expect(isBusinessDay('2026-07-04', MON_FRI)).toBe(false); // Saturday
  });

  it('is false for a working weekday that is also a holiday', () => {
    expect(isBusinessDay('2026-07-14', MON_FRI, ['2026-07-14'])).toBe(false);
  });
});

describe('businessDaysInMonth', () => {
  it('counts Mon-Fri weekdays in a 31-day month (July 2026)', () => {
    expect(businessDaysInMonth('2026-07', MON_FRI)).toBe(23);
  });

  it('counts Mon-Fri weekdays in another 31-day month (January 2026)', () => {
    expect(businessDaysInMonth('2026-01', MON_FRI)).toBe(22);
  });

  it('counts Mon-Fri weekdays in a 30-day month (April 2026)', () => {
    expect(businessDaysInMonth('2026-04', MON_FRI)).toBe(22);
  });

  it('counts Mon-Fri weekdays in a non-leap February (2026, 28 days)', () => {
    expect(businessDaysInMonth('2026-02', MON_FRI)).toBe(20);
  });

  it('counts Mon-Fri weekdays in a leap February (2028, 29 days)', () => {
    expect(businessDaysInMonth('2028-02', MON_FRI)).toBe(21);
  });

  it('accepts any date within the month, not just the 1st', () => {
    expect(businessDaysInMonth('2026-07-19', MON_FRI)).toBe(23);
  });

  it('excludes a holiday that falls on a working weekday', () => {
    // 2026-07-14 is a Tuesday.
    expect(businessDaysInMonth('2026-07', MON_FRI, ['2026-07-14'])).toBe(22);
  });

  it('is a no-op for a holiday that already falls on a weekend', () => {
    // 2026-07-04 is a Saturday, already excluded.
    expect(businessDaysInMonth('2026-07', MON_FRI, ['2026-07-04'])).toBe(23);
  });

  it('respects a wider member override (Mon-Sat)', () => {
    expect(businessDaysInMonth('2026-07', [1, 2, 3, 4, 5, 6])).toBe(27);
  });

  it('is 0 for an empty working-weekday set', () => {
    expect(businessDaysInMonth('2026-07', [])).toBe(0);
  });

  it('handles multiple holidays in the same month', () => {
    expect(businessDaysInMonth('2026-07', MON_FRI, ['2026-07-14', '2026-07-21'])).toBe(21);
  });
});

describe('businessDaysRemaining', () => {
  it('counts from a mid-month date to month end (inclusive)', () => {
    // 2026-07-15 is a Wednesday; 13 business days remain through July 31.
    expect(businessDaysRemaining('2026-07-15', '2026-07', MON_FRI)).toBe(13);
  });

  it('counts the whole month when starting from the 1st', () => {
    expect(businessDaysRemaining('2026-07-01', '2026-07', MON_FRI)).toBe(23);
  });

  it('counts the whole month when the from-date is before the month starts', () => {
    expect(businessDaysRemaining('2026-06-01', '2026-07', MON_FRI)).toBe(23);
  });

  it('is 0 when the from-date is after the month ends', () => {
    expect(businessDaysRemaining('2026-08-01', '2026-07', MON_FRI)).toBe(0);
  });

  it('excludes holidays within the remaining range', () => {
    // Remaining from 2026-07-01 excluding the 2026-07-14 holiday.
    expect(businessDaysRemaining('2026-07-01', '2026-07', MON_FRI, ['2026-07-14'])).toBe(22);
  });

  it('ignores a holiday that falls before the from-date', () => {
    // The 2026-07-14 holiday is before 2026-07-15, so it should not reduce
    // the remaining count further.
    expect(businessDaysRemaining('2026-07-15', '2026-07', MON_FRI, ['2026-07-14'])).toBe(13);
  });
});

describe('exceedsBusinessDayCap', () => {
  it('is false when strictly under the cap', () => {
    expect(exceedsBusinessDayCap(10, 1, 23)).toBe(false);
  });

  it('is false when exactly at the cap', () => {
    expect(exceedsBusinessDayCap(22, 1, 23)).toBe(false);
  });

  it('is true when over the cap', () => {
    expect(exceedsBusinessDayCap(23, 1, 23)).toBe(true);
  });

  it('absorbs floating-point rounding from fractional day math', () => {
    // 0.1 + 0.2 famously != 0.3 in floating point.
    expect(exceedsBusinessDayCap(0.1, 0.2, 0.3)).toBe(false);
  });

  it('handles fractional logged days from mixed hours_per_day across projects', () => {
    // e.g. 3 days on a 7h/day project + 2.5 days on an 8h/day project.
    const logged = 3 + 2.5;
    expect(exceedsBusinessDayCap(logged, 0, 6)).toBe(false);
    expect(exceedsBusinessDayCap(logged, 0.6, 6)).toBe(true);
  });
});

describe('remainingDayBudget', () => {
  it('is the cap minus what has been logged', () => {
    expect(remainingDayBudget(10, 23)).toBe(13);
  });

  it('never goes negative when already over the cap', () => {
    expect(remainingDayBudget(25, 23)).toBe(0);
  });

  it('is the full cap when nothing has been logged', () => {
    expect(remainingDayBudget(0, 23)).toBe(23);
  });
});
