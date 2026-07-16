import type { SubscriptionPlan } from '../schema';
import type { CompanySubscription } from './subscription.entity';

/**
 * Store product identifier -> plan/seat-limit. This is the seat-tier
 * contract; it also lives in `apps/mobile/src/lib/revenuecat-constants.ts`
 * (client purchase flow) and `backend/supabase/functions/revenuecat-webhook`
 * (Deno runtime, can't import this workspace package) — keep all three in
 * sync when a plan or product id changes.
 */
export const PRODUCT_PLAN_MAP: Record<string, { plan: SubscriptionPlan; seatLimit: number }> = {
  chrono_pro_solo: { plan: 'solo', seatLimit: 3 },
  chrono_pro_team: { plan: 'team', seatLimit: 10 },
  chrono_pro_scale: { plan: 'scale', seatLimit: 25 },
};

/** Trialing (still within its window) or actively paid. */
export function isPro(sub: CompanySubscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status === 'active') return true;
  if (sub.status === 'trialing') {
    return !sub.trial_ends_at || new Date(sub.trial_ends_at) > new Date();
  }
  return false;
}

/** Whether one more member can be added under the company's current seat limit. */
export function canAddMember(
  sub: CompanySubscription | null | undefined,
  currentMemberCount: number,
): boolean {
  if (!sub) return false;
  return currentMemberCount < sub.seat_limit;
}

/** Whole days left in the trial, or null when not trialing / already ended. */
export function trialDaysLeft(sub: CompanySubscription | null | undefined): number | null {
  if (!sub || sub.status !== 'trialing' || !sub.trial_ends_at) return null;
  const msLeft = new Date(sub.trial_ends_at).getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}
