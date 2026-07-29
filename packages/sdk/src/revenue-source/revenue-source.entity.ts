import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type RevenueSource = Tables<'revenue_sources'>;
export type RevenueSourceInsert = TablesInsert<'revenue_sources'>;
export type RevenueSourceUpdate = TablesUpdate<'revenue_sources'>;

// --- typed `content` variants (see migration: revenue_sources.content) ---

/** `type = 'time_based'` */
export type TimeBasedContent = {
  client_tjm_cents: number;
  /**
   * Manual invoice override: when set, recognition uses this fixed amount
   * every month instead of summing approved billable time entries.
   * `manual_days` is kept alongside for display (it's `manual_amount_cents / client_tjm_cents`).
   */
  manual_amount_cents?: number;
  manual_days?: number;
};

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/**
 * `type = 'recurring'`
 *
 * The schedule is per-occurrence: `amount_cents` is what ONE occurrence is
 * worth, and recognition counts the occurrences landing inside each month
 * (see `occurrencesInMonth`) to produce that month's single revenue entry.
 * The source's `starts_on` / `ends_on` columns bound the schedule.
 */
export type RecurringContent = {
  /** Amount of one occurrence. Written by every new source. */
  amount_cents?: number;
  frequency?: RecurrenceFrequency;
  /**
   * Legacy (pre-frequency) sources only: a flat per-month figure with no
   * schedule. Read when `frequency` is absent; never written by new code.
   */
  monthly_amount_cents?: number;
};

/** `type = 'self_billing'` */
export type SelfBillingContent = {
  client_tjm_cents: number;
  markup_pct?: number;
};

export type RevenueSourceContent =
  | TimeBasedContent
  | RecurringContent
  | SelfBillingContent;
