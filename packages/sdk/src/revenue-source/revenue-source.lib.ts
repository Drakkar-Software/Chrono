import type { RevenueSourceType } from '../schema';
import type {
  RecurrenceFrequency,
  RecurringContent,
  RevenueSource,
  SelfBillingContent,
  TimeBasedContent,
} from './revenue-source.entity';

const TYPE_LABELS: Record<RevenueSourceType, string> = {
  time_based: 'Time-based',
  recurring: 'Recurring',
  self_billing: 'Self-billing',
};

export function revenueSourceLabel(type: RevenueSourceType): string {
  return TYPE_LABELS[type] ?? type;
}

/** Client day rate configured on a time-based / self-billing source. */
export function sourceClientTjm(
  source: Pick<RevenueSource, 'type' | 'content'>,
): number {
  if (source.type === 'recurring') return 0;
  const content = (source.content ?? {}) as
    | TimeBasedContent
    | SelfBillingContent;
  return content.client_tjm_cents ?? 0;
}

export type RecurringSchedule = {
  /**
   * `null` for legacy sources stored before frequencies existed: a flat
   * monthly amount with no schedule to expand.
   */
  frequency: RecurrenceFrequency | null;
  /** Amount of ONE occurrence (for a legacy source, the flat monthly amount). */
  amountCents: number;
};

/**
 * The schedule configured on a recurring source, with the legacy fallback
 * resolved in one place: no `frequency` in `content` means a pre-frequency
 * source that pays `monthly_amount_cents` once every month.
 */
export function recurringSchedule(
  source: Pick<RevenueSource, 'type' | 'content'>,
): RecurringSchedule {
  if (source.type !== 'recurring') return { frequency: null, amountCents: 0 };
  const content = (source.content ?? {}) as RecurringContent;
  if (content.frequency == null) {
    return { frequency: null, amountCents: content.monthly_amount_cents ?? 0 };
  }
  return { frequency: content.frequency, amountCents: content.amount_cents ?? 0 };
}

function parseISO(dateISO: string): Date {
  return new Date(`${dateISO.slice(0, 10)}T00:00:00.000Z`);
}

/** Whole days from `from` to `to` (both UTC midnight). */
function dayDelta(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

/**
 * `day` inside the month starting at `monthStart`, clamped to the month's
 * length — a 31st anchor lands on Feb 28 (29 in a leap year). Same clamp as
 * `holidayDatesForYear` in ../company-holiday/company-holiday.lib.
 */
function anchorDayInMonth(monthStart: Date, day: number): Date {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

const CYCLE_MONTHS: Partial<Record<RecurrenceFrequency, number>> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * How many occurrences of a recurring schedule land inside one month.
 *
 * The schedule is anchored on `startsOnISO` and bounded by `endsOnISO`
 * (null = ongoing); `daily` counts calendar days, weekends and holidays
 * included. Multiplying this by the per-occurrence amount gives the month's
 * recognized revenue.
 *
 * MIRRORED IN SQL as `public.recurring_occurrences_in_month`
 * (backend/supabase/migrations/20260815000000_recurring_revenue_frequency.sql)
 * — change both together.
 */
export function occurrencesInMonth(
  frequency: RecurrenceFrequency,
  startsOnISO: string,
  endsOnISO: string | null | undefined,
  periodMonthISO: string,
): number {
  const [year, month] = periodMonthISO.slice(0, 7).split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month ?? 1, 0));

  const start = parseISO(startsOnISO);
  const end = endsOnISO ? parseISO(endsOnISO) : null;

  // Intersect the schedule's own window with the month.
  const winStart = start > monthStart ? start : monthStart;
  const winEnd = end && end < monthEnd ? end : monthEnd;
  if (winStart > winEnd) return 0;

  if (frequency === 'daily') {
    return dayDelta(winStart, winEnd) + 1;
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const step = frequency === 'weekly' ? 7 : 14;
    // Occurrences are start + step*k; count the k landing in the window.
    const firstK = Math.max(0, Math.ceil(dayDelta(start, winStart) / step));
    const lastK = Math.floor(dayDelta(start, winEnd) / step);
    return Math.max(0, lastK - firstK + 1);
  }

  const cycle = CYCLE_MONTHS[frequency] ?? 1;
  const elapsed = monthsBetween(start, monthStart);
  if (elapsed < 0 || elapsed % cycle !== 0) return 0;
  const occurrence = anchorDayInMonth(monthStart, start.getUTCDate());
  return occurrence >= winStart && occurrence <= winEnd ? 1 : 0;
}

/**
 * Manual invoice override for a time-based source (days × client TJM entered
 * directly instead of derived from approved time entries). `undefined` when
 * the source has no override — recognition falls back to logged time.
 */
export function sourceManualAmount(
  source: Pick<RevenueSource, 'type' | 'content'>,
): number | undefined {
  if (source.type !== 'time_based') return undefined;
  const content = (source.content ?? {}) as TimeBasedContent;
  return content.manual_amount_cents;
}

/** Days behind a time-based source's manual override, for display. */
export function sourceManualDays(
  source: Pick<RevenueSource, 'type' | 'content'>,
): number | undefined {
  if (source.type !== 'time_based') return undefined;
  const content = (source.content ?? {}) as TimeBasedContent;
  return content.manual_days;
}

/**
 * Headline configured amount for a source (content), before entry
 * corrections. For a recurring source this is the per-occurrence amount —
 * what one occurrence is worth, not what a given month recognizes (that is
 * `recurringRevenue`, which needs a period).
 */
export function sourceHeadlineAmount(
  source: Pick<RevenueSource, 'type' | 'content'>,
): number {
  if (source.type === 'recurring') return recurringSchedule(source).amountCents;
  const manual = sourceManualAmount(source);
  if (manual != null) return manual;
  return sourceClientTjm(source);
}

/** True when the source is kept for history but no longer generates revenue. */
export function revenueSourceInactive(
  source: Pick<RevenueSource, 'active'>,
): boolean {
  return source.active === false;
}
