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
