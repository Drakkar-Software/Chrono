import { describe, expect, it } from 'vitest';
import { countHolidaysInYear, exceedsHolidayPolicy, holidayDatesForYear } from './company-holiday.lib';

describe('holidayDatesForYear', () => {
  it('keeps a non-recurring holiday only in its own year', () => {
    const holidays = [{ holiday_date: '2026-07-14', recurring: false }];
    expect(holidayDatesForYear(holidays, 2026)).toEqual(['2026-07-14']);
    expect(holidayDatesForYear(holidays, 2027)).toEqual([]);
  });

  it('projects a recurring holiday onto any target year', () => {
    const holidays = [{ holiday_date: '2026-12-25', recurring: true }];
    expect(holidayDatesForYear(holidays, 2026)).toEqual(['2026-12-25']);
    expect(holidayDatesForYear(holidays, 2027)).toEqual(['2027-12-25']);
    expect(holidayDatesForYear(holidays, 2030)).toEqual(['2030-12-25']);
  });

  it('clamps a recurring Feb 29 into a non-leap target year', () => {
    const holidays = [{ holiday_date: '2028-02-29', recurring: true }];
    expect(holidayDatesForYear(holidays, 2026)).toEqual(['2026-02-28']);
    expect(holidayDatesForYear(holidays, 2028)).toEqual(['2028-02-29']);
  });

  it('mixes recurring and one-off holidays, sorted and deduped', () => {
    const holidays = [
      { holiday_date: '2026-12-25', recurring: true },
      { holiday_date: '2026-01-01', recurring: true },
      { holiday_date: '2026-07-14', recurring: false },
    ];
    expect(holidayDatesForYear(holidays, 2026)).toEqual(['2026-01-01', '2026-07-14', '2026-12-25']);
  });

  it('returns an empty list for no holidays', () => {
    expect(holidayDatesForYear([], 2026)).toEqual([]);
  });
});

describe('countHolidaysInYear', () => {
  it('counts the expanded holiday dates for that year', () => {
    const holidays = [
      { holiday_date: '2026-12-25', recurring: true },
      { holiday_date: '2027-07-14', recurring: false },
    ];
    expect(countHolidaysInYear(holidays, 2026)).toBe(1);
    expect(countHolidaysInYear(holidays, 2027)).toBe(2); // recurring Dec25 + the one-off
  });
});

describe('exceedsHolidayPolicy', () => {
  it('never exceeds an unlimited (null) policy', () => {
    expect(exceedsHolidayPolicy(100, 5, null)).toBe(false);
  });

  it('is false when strictly under the cap', () => {
    expect(exceedsHolidayPolicy(5, 1, 10)).toBe(false);
  });

  it('is false when exactly at the cap', () => {
    expect(exceedsHolidayPolicy(9, 1, 10)).toBe(false);
  });

  it('is true when adding would go over the cap', () => {
    expect(exceedsHolidayPolicy(10, 1, 10)).toBe(true);
  });

  it('is true when already over before adding anything', () => {
    expect(exceedsHolidayPolicy(12, 0, 10)).toBe(true);
  });

  it('is false for a zero cap with nothing added', () => {
    expect(exceedsHolidayPolicy(0, 0, 0)).toBe(false);
  });
});
