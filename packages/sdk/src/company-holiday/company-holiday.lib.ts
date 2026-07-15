/**
 * Pure holiday helpers: expanding recurring holidays into a target year, and
 * enforcing the company's holiday policy (an optional max-holidays-per-year
 * cap). No I/O — dates parsed/built in UTC to avoid timezone drift.
 */

import type { CompanyHoliday } from './company-holiday.entity';

function parseISO(dateISO: string): Date {
  return new Date(`${dateISO.slice(0, 10)}T00:00:00.000Z`);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type HolidayLike = Pick<CompanyHoliday, 'holiday_date' | 'recurring'>;

/**
 * The concrete holiday dates that apply in `year`: non-recurring holidays
 * whose own date falls in that year, plus recurring holidays' month/day
 * projected onto that year. A recurring Feb 29 clamps to Feb 28 in a
 * non-leap target year. Deduped and sorted ascending.
 */
export function holidayDatesForYear(holidays: HolidayLike[], year: number): string[] {
  const dates = new Set<string>();
  for (const h of holidays) {
    const d = parseISO(h.holiday_date);
    if (h.recurring) {
      const month = d.getUTCMonth(); // 0-indexed
      const day = d.getUTCDate();
      let occurrence = new Date(Date.UTC(year, month, day));
      if (occurrence.getUTCMonth() !== month) {
        // Overflowed (e.g. Feb 29 in a non-leap year) — clamp to month end.
        occurrence = new Date(Date.UTC(year, month + 1, 0));
      }
      dates.add(toISODate(occurrence));
    } else if (d.getUTCFullYear() === year) {
      dates.add(toISODate(d));
    }
  }
  return [...dates].sort();
}

/** How many distinct holiday dates apply in `year` (recurring ones expanded). */
export function countHolidaysInYear(holidays: HolidayLike[], year: number): number {
  return holidayDatesForYear(holidays, year).length;
}

/**
 * Whether adding `addingCount` more holidays on top of `currentYearCount`
 * would exceed the company's policy. `null` policy = unlimited, never
 * exceeded.
 */
export function exceedsHolidayPolicy(
  currentYearCount: number,
  addingCount: number,
  maxHolidaysPerYear: number | null,
): boolean {
  if (maxHolidaysPerYear == null) return false;
  return currentYearCount + addingCount > maxHolidaysPerYear;
}
