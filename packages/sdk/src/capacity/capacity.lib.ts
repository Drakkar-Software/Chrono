/**
 * Utilization = worked days / capacity days, where capacity days are derived
 * from a member's `weekly_capacity_days` prorated over a date range. v1 is
 * actuals-only (no forward booking/allocation — see the plan's phase 2 note).
 *
 * Remuneration uses a separate fixed monthly baseline (`monthlyCapacityDays` /
 * `monthlyCapacityHours`) — weekdays only control calendar placement.
 */

import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_MONTHLY_CAPACITY_DAYS,
  MINUTES_PER_HOUR,
} from '../constants';

export type DateRange = { from?: string; to?: string };

/** Fixed monthly rem/logging capacity in day-equivalents (canonical: 22). */
export function monthlyCapacityDays(
  capacityDays = DEFAULT_MONTHLY_CAPACITY_DAYS,
): number {
  return Math.max(0, capacityDays);
}

/** Fixed monthly rem/logging capacity in hours (canonical: 22 × 8 = 176). */
export function monthlyCapacityHours(
  capacityDays = DEFAULT_MONTHLY_CAPACITY_DAYS,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): number {
  return monthlyCapacityDays(capacityDays) * Math.max(0, hoursPerDay);
}

/** Fixed monthly rem/logging capacity in minutes. */
export function monthlyCapacityMinutes(
  capacityDays = DEFAULT_MONTHLY_CAPACITY_DAYS,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): number {
  return monthlyCapacityHours(capacityDays, hoursPerDay) * MINUTES_PER_HOUR;
}

/** True when worked + leave day-equivalents exceed the fixed monthly baseline. */
export function exceedsMonthlyCapacity(
  usedDayEquivalents: number,
  addingDayEquivalents = 0,
  capacityDays = DEFAULT_MONTHLY_CAPACITY_DAYS,
): boolean {
  return usedDayEquivalents + addingDayEquivalents > monthlyCapacityDays(capacityDays) + 1e-9;
}

function daysBetweenInclusive(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO.slice(0, 10)}T00:00:00.000Z`);
  const to = new Date(`${toISO.slice(0, 10)}T00:00:00.000Z`);
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / 86_400_000) + 1);
}

/**
 * Capacity days for one member over a range, prorating partial weeks.
 * Returns 0 for an open-ended range (no `from`/`to`) — there is no bounded
 * denominator to divide by, so utilization is undefined there.
 */
export function capacityDaysInRange(weeklyCapacityDays: number, range: DateRange): number {
  if (!range.from || !range.to) return 0;
  const days = daysBetweenInclusive(range.from, range.to);
  return (days / 7) * weeklyCapacityDays;
}

/** Utilization percentage; 0 when capacity is 0 (nothing to divide by). */
export function utilization(workedDays: number, capacityDays: number): number {
  if (capacityDays <= 0) return 0;
  return (workedDays / capacityDays) * 100;
}

export type UtilizationStatus = 'under' | 'ok' | 'over';

/** Flags over-capacity (>100%) and under-utilized (<`underAt`, default 70%) freelancers. */
export function utilizationStatus(pct: number, underAt = 70): UtilizationStatus {
  if (pct > 100) return 'over';
  if (pct < underAt) return 'under';
  return 'ok';
}
