import { monthBounds, shiftEntryDate, weekBounds } from '@chrono/sdk';

export type CalendarCell = { date: string; inMonth: boolean };

/**
 * Monday-first calendar grid (rows of 7 days) covering `monthISO`'s month,
 * padded with the leading/trailing days from adjacent months needed to
 * complete each week — the shape a month calendar UI renders directly.
 */
export function buildMonthGrid(monthISO: string): CalendarCell[][] {
  const { start, end } = monthBounds(monthISO);
  const gridStart = weekBounds(start).start;
  const gridEnd = weekBounds(end).end;
  const monthPrefix = start.slice(0, 7);

  const weeks: CalendarCell[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor.slice(0, 7) === monthPrefix });
      cursor = shiftEntryDate(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
