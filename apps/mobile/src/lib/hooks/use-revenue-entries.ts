import { useLinkedQuery } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchRevenueEntries, recognizeRevenue } from '@chrono/sdk';
import type { RevenueEntry, RevenueEntryFilters } from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

type Refetch = () => Promise<void>;

export function useRevenueEntries(projectId: string | undefined, filters?: RevenueEntryFilters) {
  return useLinkedQuery(
    () => fetchRevenueEntries(globalSupabaseClient, projectId!, filters),
    {
      stores: [stores.revenue_entries],
      enabled: !!projectId,
      deps: [projectId, JSON.stringify(filters)],
      staleTime: 60_000,
      queryKey: `revenue-entries:${projectId}:${JSON.stringify(filters)}`,
    },
  ) as { data: RevenueEntry[] | undefined; isLoading: boolean; error: unknown; refetch: Refetch };
}

/**
 * All (non-deleted) revenue entries for a company in ONE round-trip, for the
 * reports P&L which groups by project client-side. Avoids a per-project fan-out
 * (the SDK's `fetchRevenueEntries` is project-scoped and would N+1 here).
 */
export function useCompanyRevenueEntries(companyId: string | undefined) {
  return useLinkedQuery(
    async () => {
      const { data, error } = await globalSupabaseClient
        .from('revenue_entries')
        .select('*')
        .eq('company_id', companyId!)
        .eq('deleted', false)
        .order('period_month', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RevenueEntry[];
    },
    {
      stores: [stores.revenue_entries],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-revenue-entries:${companyId}`,
    },
  ) as { data: RevenueEntry[] | undefined; isLoading: boolean; error: unknown; refetch: Refetch };
}

/** Recognize a project's revenue for a month (RPC). */
export function useRecognizeRevenue() {
  return useAsyncAction((projectId: string, month: string) =>
    recognizeRevenue(globalSupabaseClient, projectId, month),
  );
}
