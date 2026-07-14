import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchMyReferralEarnings, fetchReferralEarnings } from '@chrono/sdk';
import type { ReferralEarning, ReferralEarningFilters } from '@chrono/sdk';

export function useReferralEarnings(filters: ReferralEarningFilters) {
  // Guard against an unscoped fetch: require at least one concrete scope so an
  // empty filter can't pull every RLS-visible row.
  const scoped = !!(filters.companyId || filters.projectId || filters.referrerId);
  return linkedQuery<ReferralEarning[]>(
    () => fetchReferralEarnings(globalSupabaseClient, filters),
    {
      stores: [stores.referral_earnings],
      enabled: scoped,
      deps: [JSON.stringify(filters)],
      staleTime: 60_000,
      queryKey: `referral-earnings:${JSON.stringify(filters)}`,
    },
  );
}

export function useMyReferralEarnings(userId: string | undefined, companyId: string | undefined) {
  return linkedQuery<ReferralEarning[]>(
    () => fetchMyReferralEarnings(globalSupabaseClient, userId!, companyId!),
    {
      stores: [stores.referral_earnings],
      enabled: !!userId && !!companyId,
      deps: [userId, companyId],
      staleTime: 60_000,
      queryKey: `my-referral-earnings:${userId}:${companyId}`,
    },
  );
}
