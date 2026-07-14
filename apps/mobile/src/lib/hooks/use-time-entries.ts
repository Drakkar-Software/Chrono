import { useLinkedQuery } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { todayISO } from '@/lib/date';
import { fetchTimeEntries, fetchWeekEntries } from '@chrono/sdk';
import type { TimeEntryFilters, TimeEntryWithProject } from '@chrono/sdk';

type Result = {
  data: TimeEntryWithProject[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
};

// NOTE: these read queries subscribe to the time_entries store (so a mutation —
// log / edit / approve — auto-refreshes the list) but do NOT `mergeToStore`.
// `useLinkedQuery` only guards a query against *its own* merge, so two instances
// merging the same store (Reports, Today's this/last week, Home's dashboards)
// would each see the other's merge and refetch forever. Not merging means only
// real mutations ever change the store, so the refresh-loop can't form.

export function useTimeEntries(filters: TimeEntryFilters) {
  return useLinkedQuery(
    () => fetchTimeEntries(globalSupabaseClient, filters),
    {
      stores: [stores.time_entries],
      enabled: !!filters.companyId,
      deps: [JSON.stringify(filters)],
      staleTime: 30_000,
      queryKey: `time-entries:${JSON.stringify(filters)}`,
    },
  ) as Result;
}

/** Monday-based week of entries for one user. */
export function useWeekEntries(
  userId: string | undefined,
  companyId: string | undefined,
  weekStart: string,
) {
  return useLinkedQuery(
    () => fetchWeekEntries(globalSupabaseClient, userId!, companyId!, weekStart),
    {
      stores: [stores.time_entries],
      enabled: !!userId && !!companyId,
      deps: [userId, companyId, weekStart],
      staleTime: 30_000,
      queryKey: `week-entries:${userId}:${companyId}:${weekStart}`,
    },
  ) as Result;
}

/** Today's entries for one user (single-day window). */
export function useTodayEntries(userId: string | undefined, companyId: string | undefined) {
  const today = todayISO();
  return useLinkedQuery(
    () =>
      fetchTimeEntries(globalSupabaseClient, {
        companyId: companyId!,
        userId: userId!,
        from: today,
        to: today,
      }),
    {
      stores: [stores.time_entries],
      enabled: !!userId && !!companyId,
      deps: [userId, companyId, today],
      staleTime: 30_000,
      queryKey: `today-entries:${userId}:${companyId}:${today}`,
    },
  ) as Result;
}
