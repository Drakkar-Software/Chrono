import { useLinkedQuery } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchMyReferralEarnings, fetchReferralEarnings } from '@chrono/sdk';
import type { ReferralEarning, ReferralEarningFilters } from '@chrono/sdk';

type Refetch = () => Promise<void>;

export function useReferralEarnings(filters: ReferralEarningFilters) {
  // Guard against an unscoped fetch: require at least one concrete scope so an
  // empty filter can't pull every RLS-visible row.
  const scoped = !!(filters.companyId || filters.projectId || filters.referrerId);
  return useLinkedQuery(
    () => fetchReferralEarnings(globalSupabaseClient, filters),
    {
      stores: [stores.referral_earnings],
      enabled: scoped,
      deps: [JSON.stringify(filters)],
      mergeToStore: stores.referral_earnings,
      staleTime: 60_000,
      queryKey: `referral-earnings:${JSON.stringify(filters)}`,
    },
  ) as { data: ReferralEarning[] | undefined; isLoading: boolean; error: unknown; refetch: Refetch };
}

export function useMyReferralEarnings(userId: string | undefined, companyId: string | undefined) {
  return useLinkedQuery(
    () => fetchMyReferralEarnings(globalSupabaseClient, userId!, companyId!),
    {
      stores: [stores.referral_earnings],
      enabled: !!userId && !!companyId,
      deps: [userId, companyId],
      mergeToStore: stores.referral_earnings,
      staleTime: 60_000,
      queryKey: `my-referral-earnings:${userId}:${companyId}`,
    },
  ) as { data: ReferralEarning[] | undefined; isLoading: boolean; error: unknown; refetch: Refetch };
}
