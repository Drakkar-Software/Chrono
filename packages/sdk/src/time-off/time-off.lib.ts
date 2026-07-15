/**
 * Pure time-off helpers: how many business days a person's time off consumes
 * in a month (for netting out of `businessDaysInMonth`'s capacity figure),
 * and grouping time off for calendar display. No I/O — dates compared by
 * their 'YYYY-MM-DD' / 'YYYY-MM' string slices, same convention as
 * time-entry.lib and business-days.lib.
 */

import { isBusinessDay } from '../business-days/business-days.lib';
import { minutesToDays } from '../time-entry/time-entry.lib';
import type { TimeOff } from './time-off.entity';

type TimeOffLike = Pick<TimeOff, 'off_date' | 'duration_minutes'>;

function inMonth(dateISO: string, monthISO: string): boolean {
  return dateISO.slice(0, 7) === monthISO.slice(0, 7);
}

/**
 * Fractional business days consumed by time off in `monthISO`: a full day
 * (`duration_minutes == null`) counts as 1, a partial day converts its
 * minutes via `minutesToDays` (the same day-length used for money/day math).
 * Time off on a date that isn't a business day (weekend, or a day already
 * excluded by a company holiday) contributes 0 — it can't consume capacity
 * that was never counted in the first place.
 */
export function timeOffDaysInMonth(
  entries: TimeOffLike[],
  monthISO: string,
  workingWeekdays: number[],
  holidayDates: string[],
  hoursPerDay: number,
): number {
  let total = 0;
  for (const e of entries) {
    if (!inMonth(e.off_date, monthISO)) continue;
    if (!isBusinessDay(e.off_date, workingWeekdays, holidayDates)) continue;
    total += e.duration_minutes == null ? 1 : minutesToDays(e.duration_minutes, hoursPerDay);
  }
  return total;
}

/** Full-day time-off dates ('YYYY-MM-DD') falling within `monthISO`. */
export function fullDayOffDatesInMonth(entries: TimeOffLike[], monthISO: string): string[] {
  return entries
    .filter((e) => e.duration_minutes == null && inMonth(e.off_date, monthISO))
    .map((e) => e.off_date.slice(0, 10));
}

/** Partial time-off minutes, keyed by date ('YYYY-MM-DD'), within `monthISO`. */
export function partialOffMinutesByDate(
  entries: TimeOffLike[],
  monthISO: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.duration_minutes == null || !inMonth(e.off_date, monthISO)) continue;
    out[e.off_date.slice(0, 10)] = e.duration_minutes;
  }
  return out;
}
