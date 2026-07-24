import { exceedsBusinessDayCap, minutesToDays } from '@chrono/sdk';

/** Parse a locale-decimal hours string ("7,5", "-2", "−1.5") into whole minutes. */
export function parseHoursToMinutes(input: string): number {
  const normalized = input.trim().replace(',', '.').replace('−', '-');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0;
}

/** Format whole minutes back into a locale-decimal hours string (inverse of `parseHoursToMinutes`), trimming a trailing ".0". */
export function formatMinutesAsHoursInput(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}

/** True when duration is a valid non-zero entry (positive work or negative correction). */
export function isValidDurationMinutes(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes !== 0;
}

/**
 * Whether logging `candidateMinutes` (at `hoursPerDay`) on top of what the
 * person has already logged this period (`loggedDaysExcludingThis` — the
 * period total, minus this entry's own days when editing) would push them
 * past the period's business-day cap.
 *
 * Negative corrections reduce the total and never trip the cap.
 */
export function dayCapExceeded(
  candidateMinutes: number,
  hoursPerDay: number,
  loggedDaysExcludingThis: number,
  maxBusinessDays: number,
): boolean {
  if (candidateMinutes <= 0) return false;
  const candidateDays = minutesToDays(candidateMinutes, hoursPerDay);
  return exceedsBusinessDayCap(loggedDaysExcludingThis, candidateDays, maxBusinessDays);
}
