import { monthBounds, weekBounds } from '@chrono/sdk';
import { todayISO } from '@/lib/date';

/** History period: all time, current calendar week, or a month `'YYYY-MM'`. */
export type HistoryPeriod = 'all' | 'thisWeek' | string;

/** `YYYY-MM` for the month containing `dateISO`. */
export function currentMonthKey(dateISO = todayISO()): string {
  return dateISO.slice(0, 7);
}

/**
 * Resolve a history period to `{ from, to }` `YYYY-MM-DD` bounds
 * (both `undefined` for `'all'`) suitable for `useTimeEntries` filters.
 */
export function rangeBounds(period: HistoryPeriod): { from?: string; to?: string } {
  const today = todayISO();
  if (period === 'all') return {};
  if (period === 'thisWeek') {
    const { start, end } = weekBounds(today);
    return { from: start, to: end };
  }
  // Calendar month `'YYYY-MM'` (or `'YYYY-MM-DD'`).
  if (/^\d{4}-\d{2}/.test(period)) {
    const { start, end } = monthBounds(`${period.slice(0, 7)}-01`);
    return { from: start, to: end };
  }
  return {};
}
