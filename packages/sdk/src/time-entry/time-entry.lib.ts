import { MINUTES_PER_HOUR } from '../constants';
import type { TimeEntry } from './time-entry.entity';

// ---------------------------------------------------------------------------
// Core time -> days -> cents math. Keep ALL conversions flowing through these
// two helpers so rounding matches the DB RPC:
//   round(minutes / (hours_per_day * 60) * tjm)
// ---------------------------------------------------------------------------

/** Fractional working days represented by a number of minutes. */
export function minutesToDays(minutes: number, hoursPerDay: number): number {
  if (!hoursPerDay || hoursPerDay <= 0) return 0;
  return minutes / (hoursPerDay * MINUTES_PER_HOUR);
}

/**
 * Cents earned for `minutes` at day rate `tjmCents`, given a working day of
 * `hoursPerDay` hours. Rounds to whole cents to match the Postgres RPC.
 */
export function computeEarnedCents(
  minutes: number,
  hoursPerDay: number,
  tjmCents: number,
): number {
  return Math.round(minutesToDays(minutes, hoursPerDay) * tjmCents);
}

/** Format a minute count as "7h 30m" / "45m" / "2h" / "−2h" (signed corrections). */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? '−' : '';
  const total = Math.abs(rounded);
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/** Sum of durations across entries (minutes). */
export function sumDurations(
  entries: Array<Pick<TimeEntry, 'duration_minutes'>>,
): number {
  return entries.reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Date helpers. entry_date is a 'YYYY-MM-DD' string; period_month is
// 'YYYY-MM-01'. All math is done in UTC to avoid timezone drift.
// ---------------------------------------------------------------------------

function parseISO(dateISO: string): Date {
  // Accept 'YYYY-MM-DD' or a full ISO timestamp — keep only the date part.
  const dayPart = dateISO.slice(0, 10);
  return new Date(`${dayPart}T00:00:00.000Z`);
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** First day of the month for a date, as 'YYYY-MM-01'. */
export function monthKey(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

/** Shift a month key ('YYYY-MM-01') by `delta` whole months, year-rollover safe. */
export function shiftMonth(monthISO: string, delta: number): string {
  const [y, m] = monthISO.slice(0, 7).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1));
  return `${dt.toISOString().slice(0, 7)}-01`;
}

/** Monday-based week bounds { start, end } as 'YYYY-MM-DD'. */
export function weekBounds(dateISO: string): { start: string; end: string } {
  const d = parseISO(dateISO);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const offsetToMonday = (day + 6) % 7; // Monday -> 0 ... Sunday -> 6
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - offsetToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: toISO(start), end: toISO(end) };
}

/** Calendar month bounds { start, end } as 'YYYY-MM-DD'. */
export function monthBounds(dateISO: string): { start: string; end: string } {
  const d = parseISO(dateISO);
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  );
  return { start: toISO(start), end: toISO(end) };
}

/** Calendar year bounds { start, end } as 'YYYY-MM-DD'. */
export function yearBounds(dateISO: string): { start: string; end: string } {
  const d = parseISO(dateISO);
  const year = d.getUTCFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// ---------------------------------------------------------------------------
// Grouping / summarizing
// ---------------------------------------------------------------------------

export function groupByDay<T extends Pick<TimeEntry, 'entry_date'>>(
  entries: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const entry of entries) {
    const key = entry.entry_date.slice(0, 10);
    (out[key] ??= []).push(entry);
  }
  return out;
}

export function groupByWeek<T extends Pick<TimeEntry, 'entry_date'>>(
  entries: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const entry of entries) {
    const key = weekBounds(entry.entry_date).start;
    (out[key] ??= []).push(entry);
  }
  return out;
}

export type EntrySummary = { minutes: number; count: number };

export function summarizeByProject(
  entries: Array<Pick<TimeEntry, 'project_id' | 'duration_minutes'>>,
): Record<string, EntrySummary> {
  const out: Record<string, EntrySummary> = {};
  for (const entry of entries) {
    const acc = (out[entry.project_id] ??= { minutes: 0, count: 0 });
    acc.minutes += entry.duration_minutes ?? 0;
    acc.count += 1;
  }
  return out;
}

export function summarizeByUser(
  entries: Array<Pick<TimeEntry, 'user_id' | 'duration_minutes'>>,
): Record<string, EntrySummary> {
  const out: Record<string, EntrySummary> = {};
  for (const entry of entries) {
    const acc = (out[entry.user_id] ??= { minutes: 0, count: 0 });
    acc.minutes += entry.duration_minutes ?? 0;
    acc.count += 1;
  }
  return out;
}

/** All distinct tags across entries, sorted alphabetically. */
export function allTags(entries: Array<Pick<TimeEntry, 'tags'>>): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const t of e.tags ?? []) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Minutes + count per tag (an entry with multiple tags counts under each). */
export function summarizeByTag(
  entries: Array<Pick<TimeEntry, 'tags' | 'duration_minutes'>>,
): Record<string, EntrySummary> {
  const out: Record<string, EntrySummary> = {};
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      const acc = (out[tag] ??= { minutes: 0, count: 0 });
      acc.minutes += entry.duration_minutes ?? 0;
      acc.count += 1;
    }
  }
  return out;
}

/** Parse a comma/space-separated tag input into a normalized, deduped list. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,\n]/)) {
    const t = raw.trim().toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen];
}

type CopyableEntry = Pick<
  TimeEntry,
  'project_id' | 'duration_minutes' | 'description' | 'billable' | 'tags' | 'entry_date'
>;

/**
 * Build insert payloads that clone `entries` shifted by a whole number of days
 * (e.g. +7 to copy last week into this week). Preserves project/duration/tags,
 * resets money/approval state (those default on insert). `shiftDays` moves each
 * entry's `entry_date` forward.
 */
export function shiftEntryDate(dateISO: string, shiftDays: number): string {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + shiftDays);
  return dt.toISOString().slice(0, 10);
}

export function buildCopiedEntries<T extends CopyableEntry>(
  entries: T[],
  shiftDays: number,
): Array<Pick<TimeEntry, 'project_id' | 'entry_date' | 'duration_minutes' | 'description' | 'billable' | 'tags'>> {
  return entries.map((e) => ({
    project_id: e.project_id,
    entry_date: shiftEntryDate(e.entry_date, shiftDays),
    duration_minutes: e.duration_minutes,
    description: e.description,
    billable: e.billable,
    tags: e.tags ?? [],
  }));
}
