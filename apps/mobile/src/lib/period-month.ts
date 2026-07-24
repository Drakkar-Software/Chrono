import { lastMonths } from '@/lib/reports';
import { todayISO } from '@/lib/date';

/** `'all'` lifetime totals, or a calendar month key `'YYYY-MM'`. */
export type StatsPeriod = 'all' | string;

/** Last `count` months ending at today, newest first, as `'YYYY-MM'` keys. */
export function selectableMonths(count = 24, today = todayISO()): string[] {
  return lastMonths(today, count).slice().reverse();
}

/** True when `periodMonth` (any `'YYYY-MM…'` string) matches the selected month. */
export function matchesPeriodMonth(periodMonth: string, selected: string): boolean {
  return periodMonth.slice(0, 7) === selected.slice(0, 7);
}

/** Long locale month label ("July 2026" / "juillet 2026"). */
export function longMonthLabel(yyyyMm: string, locale: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  try {
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return yyyyMm;
  }
}

/** Compact stamp label ("JUL · 26"). */
export function stampMonthLabel(yyyyMm: string, locale: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  try {
    const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    return `${month.replace(/\.$/, '').toUpperCase()} · ${String(y).slice(2)}`;
  } catch {
    return yyyyMm;
  }
}
