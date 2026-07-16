import type { Tables } from '../schema';

// SubscriptionStatus / SubscriptionPlan are exported from '../schema' (re-exported via index.ts).
export type CompanySubscription = Tables<'company_subscriptions'>;
