import { canAddMember, fetchCompanySubscription, isPro, trialDaysLeft } from '@chrono/sdk';
import type { CompanySubscription } from '@chrono/sdk';

import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { useIsProLive } from '@/lib/revenuecat-live-state';
import { useCompanyMembers } from './use-company-members';

/** The company's synced billing row (offline-safe — from `company_subscriptions`, not live RevenueCat). */
export function useCompanySubscription(companyId: string | undefined) {
  return linkedQuery<CompanySubscription | null>(
    () => fetchCompanySubscription(globalSupabaseClient, companyId!),
    {
      stores: [stores.company_subscriptions],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-subscription:${companyId}`,
    },
  );
}

/**
 * Chrono Pro status for the active company. ORs the synced `company_subscriptions`
 * row with this device's live RevenueCat read, so the purchasing admin's device
 * flips to Pro immediately (before the webhook lands) while every other member
 * reads a consistent, offline-safe answer from the synced row.
 */
export function useChronoPro(companyId: string | undefined) {
  const { data: sub, isLoading } = useCompanySubscription(companyId);
  const { data: members } = useCompanyMembers(companyId);
  const liveIsPro = useIsProLive();

  const seatCount = members?.length ?? 0;

  return {
    sub,
    isLoading,
    isPro: isPro(sub) || liveIsPro,
    seatLimit: sub?.seat_limit ?? null,
    seatCount,
    canAddMember: canAddMember(sub, seatCount),
    trialDaysLeft: trialDaysLeft(sub),
  };
}
