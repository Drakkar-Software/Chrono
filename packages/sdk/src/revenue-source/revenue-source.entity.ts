import type {
  RevenueSourceType,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../schema';

export type RevenueSource = Tables<'revenue_sources'>;
export type RevenueSourceInsert = TablesInsert<'revenue_sources'>;
export type RevenueSourceUpdate = TablesUpdate<'revenue_sources'>;

// --- typed `content` variants (see migration: revenue_sources.content) ---

/** `type = 'time_based'` */
export type TimeBasedContent = {
  client_tjm_cents: number;
};

/** `type = 'recurring'` */
export type RecurringContent = {
  monthly_amount_cents: number;
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

export type { RevenueSourceType };
