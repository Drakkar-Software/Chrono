import { monthBounds, weekBounds } from '@chrono/sdk';
import type { HistoryRange } from '@/components/common/HistoryFilters';
import { todayISO } from '@/lib/date';

/** `YYYY-MM-01` for the month `n` months before the given `YYYY-MM-DD`. */
function monthOffsetISO(dateISO: string, offset: number): string {
  const [y, m] = dateISO.slice(0, 7).split('-').map(Number);
  const base = new Date(Date.UTC(y, (m ?? 1) - 1 + offset, 1));
  return base.toISOString().slice(0, 10);
}

/**
 * Resolve a {@link HistoryRange} preset to `{ from, to }` `YYYY-MM-DD` bounds
 * (both `undefined` for `'all'`) suitable for `useTimeEntries` filters.
 */
export function rangeBounds(range: HistoryRange): { from?: string; to?: string } {
  const today = todayISO();
  switch (range) {
    case 'thisMonth': {
      const { start, end } = monthBounds(today);
      return { from: start, to: end };
    }
    case 'lastMonth': {
      const { start, end } = monthBounds(monthOffsetISO(today, -1));
      return { from: start, to: end };
    }
    case 'thisWeek': {
      const { start, end } = weekBounds(today);
      return { from: start, to: end };
    }
    case 'all':
    default:
      return {};
  }
}
