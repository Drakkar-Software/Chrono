import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchRevenueSources } from '@chrono/sdk';
import type { RevenueSource, TablesInsert, TablesUpdate } from '@chrono/sdk';

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
  const deactivate = useCallback(
    (id: string) => update(id, { active: false }),
    [update],
  );

  return { create, update: patch, deactivate, isPending: isLoading, error };
}
