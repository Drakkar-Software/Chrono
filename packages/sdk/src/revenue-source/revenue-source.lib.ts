import type { RevenueSourceType } from '../schema';
import type {
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

/** Fixed monthly amount for a recurring source (0 for other types). */
export function monthlyRecurringAmount(
  source: Pick<RevenueSource, 'type' | 'content'>,
): number {
  if (source.type !== 'recurring') return 0;
  const content = (source.content ?? {}) as RecurringContent;
  return content.monthly_amount_cents ?? 0;
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
