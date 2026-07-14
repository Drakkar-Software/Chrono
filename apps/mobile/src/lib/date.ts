/**
 * Local-time date helpers.
 *
 * The `@chrono/ui` DatePicker works entirely in LOCAL time (it builds and reads
 * `Date`s from local Y/M/D components). Serializing those with `toISOString()`
 * converts through UTC and, for any positive-UTC-offset locale (e.g. fr-FR at
 * UTC+1/+2), shifts the stored `entry_date` to the previous day. Always round-trip
 * calendar dates through these local helpers instead of `toISOString().slice(0,10)`.
 */

/** Format a Date as a local `YYYY-MM-DD` (no timezone shift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a `YYYY-MM-DD` string into a LOCAL-midnight Date (matches the picker). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Short localized month label ("Jul") for a 'YYYY-MM' key. */
export function shortMonthLabel(yyyyMm: string, locale = 'fr-FR'): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  try {
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return yyyyMm.slice(5);
  }
}

/** Compact relative time ("just now", "5m", "3h", "2d") for a timestamp. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w`;
  return `${Math.round(diffDay / 30)}mo`;
}
