import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { correctRevenueSource, fetchRevenueSources } from '@chrono/sdk';
import type { RevenueSource, TablesInsert, TablesUpdate } from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

export function useRevenueSources(projectId: string | undefined) {
  return linkedQuery<RevenueSource[]>(
    () => fetchRevenueSources(globalSupabaseClient, projectId!),
    {
      stores: [stores.revenue_sources],
      enabled: !!projectId,
      deps: [projectId],
      staleTime: 60_000,
      queryKey: `revenue-sources:${projectId}`,
    },
  );
}

export function useRevenueSourceMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.revenue_sources);

  const create = useCallback(
    (input: TablesInsert<'revenue_sources'>) => insert(input),
    [insert],
  );
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'revenue_sources'>) => update(id, updates),
    [update],
  );

  return { create, update: patch, isPending: isLoading, error };
}

/**
 * Deactivate a source and insert offsetting negative revenue entries (RPC).
 * Bumps both revenue stores so lists re-fetch.
 */
export function useCorrectRevenueSource() {
  return useAsyncAction(async (sourceId: string) => {
    await correctRevenueSource(globalSupabaseClient, sourceId);
    stores.revenue_sources.getState().mergeRecords([]);
    stores.revenue_entries.getState().mergeRecords([]);
  });
}
