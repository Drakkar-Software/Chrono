import { useLinkedQuery } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchRevenueEntries, recognizeRevenue } from '@chrono/sdk';
import type { RevenueEntry, RevenueEntryFilters } from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

export function useRevenueEntries(projectId: string | undefined, filters?: RevenueEntryFilters) {
  return useLinkedQuery(
    () => fetchRevenueEntries(globalSupabaseClient, projectId!, filters),
    {
      stores: [stores.revenue_entries],
      enabled: !!projectId,
      deps: [projectId, JSON.stringify(filters)],
      mergeToStore: stores.revenue_entries,
      staleTime: 60_000,
      queryKey: `revenue-entries:${projectId}:${JSON.stringify(filters)}`,
    },
  ) as { data: RevenueEntry[] | undefined; isLoading: boolean; error: unknown };
}

/** Recognize a project's revenue for a month (RPC). */
export function useRecognizeRevenue() {
  return useAsyncAction((projectId: string, month: string) =>
    recognizeRevenue(globalSupabaseClient, projectId, month),
  );
}
