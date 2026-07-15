/**
 * Business-day math: how many working days exist in a period, and whether a
 * person's logged days exceed that cap. Pure, no I/O — dates are parsed and
 * iterated in UTC to avoid timezone drift (same pattern as time-entry.lib).
 *
 * "Working weekdays" and holiday dates are configuration inputs resolved
 * elsewhere (company default, optional per-member override, expanded
 * recurring holidays — see company-holiday.lib) and passed in here already
 * resolved.
 */

const EPSILON = 1e-9;

function parseISO(dateISO: string): Date {
  return new Date(`${dateISO.slice(0, 10)}T00:00:00.000Z`);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO weekday for a date: 1=Monday .. 7=Sunday. */
export function isoWeekday(dateISO: string): number {
  const day = parseISO(dateISO).getUTCDay(); // 0=Sun..6=Sat
  return ((day + 6) % 7) + 1;
}

function monthRange(monthISO: string): { start: Date; end: Date } {
  const [y, m] = monthISO.slice(0, 7).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // last day of month
  return { start, end };
}

/**
 * The working weekdays to use for a member: their own override if set,
 * otherwise the company default.
 */
export function resolveWorkingWeekdays(
  companyDefault: number[],
  memberOverride?: number[] | null,
): number[] {
  return memberOverride != null ? memberOverride : companyDefault;
}

export function isHoliday(dateISO: string, holidayDates: string[]): boolean {
  const day = dateISO.slice(0, 10);
  return holidayDates.some((h) => h.slice(0, 10) === day);
}

export function isBusinessDay(
  dateISO: string,
  workingWeekdays: number[],
  holidayDates: string[] = [],
): boolean {
  return workingWeekdays.includes(isoWeekday(dateISO)) && !isHoliday(dateISO, holidayDates);
}

/** Count of business days in a calendar month ('YYYY-MM' or any date within it). */
export function businessDaysInMonth(
  monthISO: string,
  workingWeekdays: number[],
  holidayDates: string[] = [],
): number {
  const { start, end } = monthRange(monthISO);
  const workSet = new Set(workingWeekdays);
  const holidays = new Set(holidayDates.map((h) => h.slice(0, 10)));
  let count = 0;
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    const iso = toISODate(cur);
    if (workSet.has(isoWeekday(iso)) && !holidays.has(iso)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/**
 * Business days remaining in the month from `fromISO` (inclusive) onward.
 * If `fromISO` falls before the month, counts the whole month; if it falls
 * after the month's end, returns 0.
 */
export function businessDaysRemaining(
  fromISO: string,
  monthISO: string,
  workingWeekdays: number[],
  holidayDates: string[] = [],
): number {
  const { start, end } = monthRange(monthISO);
  const from = parseISO(fromISO);
  const rangeStart = from.getTime() > start.getTime() ? from : start;
  if (rangeStart.getTime() > end.getTime()) return 0;
  const workSet = new Set(workingWeekdays);
  const holidays = new Set(holidayDates.map((h) => h.slice(0, 10)));
  let count = 0;
  const cur = new Date(rangeStart);
  while (cur.getTime() <= end.getTime()) {
    const iso = toISODate(cur);
    if (workSet.has(isoWeekday(iso)) && !holidays.has(iso)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/**
 * Whether logging `candidateDays` on top of `loggedDays` (already logged
 * this period, excluding the entry being edited) would push the person past
 * `maxBusinessDays`. A small epsilon absorbs floating-point rounding from
 * fractional day math (minutesToDays).
 */
export function exceedsBusinessDayCap(
  loggedDays: number,
  candidateDays: number,
  maxBusinessDays: number,
): boolean {
  return loggedDays + candidateDays > maxBusinessDays + EPSILON;
}

/** Remaining day budget for the period; never negative. */
export function remainingDayBudget(loggedDays: number, maxBusinessDays: number): number {
  return Math.max(0, maxBusinessDays - loggedDays);
}
