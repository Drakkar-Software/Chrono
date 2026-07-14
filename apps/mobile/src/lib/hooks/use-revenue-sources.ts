import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchRevenueSources } from '@chrono/sdk';
import type { RevenueSource, TablesInsert, TablesUpdate } from '@chrono/sdk';

export function useRevenueSources(projectId: string | undefined) {
  return useLinkedQuery(
    () => fetchRevenueSources(globalSupabaseClient, projectId!),
    {
      stores: [stores.revenue_sources],
      enabled: !!projectId,
      deps: [projectId],
      mergeToStore: stores.revenue_sources,
      staleTime: 60_000,
      queryKey: `revenue-sources:${projectId}`,
    },
  ) as { data: RevenueSource[] | undefined; isLoading: boolean; error: unknown };
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
  const deactivate = useCallback(
    (id: string) => update(id, { active: false }),
    [update],
  );

  return { create, update: patch, deactivate, isPending: isLoading, error };
}
