import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProjectFixedCosts } from '@chrono/sdk';
import type { ProjectFixedCost, TablesInsert, TablesUpdate } from '@chrono/sdk';

export function useProjectFixedCosts(projectId: string | undefined) {
  return linkedQuery<ProjectFixedCost[]>(
    () => fetchProjectFixedCosts(globalSupabaseClient, projectId!),
    {
      stores: [stores.project_fixed_costs],
      enabled: !!projectId,
      deps: [projectId],
      staleTime: 60_000,
      queryKey: `project-fixed-costs:${projectId}`,
    },
  );
}

/**
 * All (non-deleted) fixed costs for a company in ONE round-trip, for the
 * reports P&L which groups by project client-side — mirrors
 * `useCompanyRevenueEntries` (avoids a per-project fan-out).
 */
export function useCompanyProjectFixedCosts(companyId: string | undefined) {
  return linkedQuery<ProjectFixedCost[]>(
    async () => {
      const { data, error } = await globalSupabaseClient
        .from('project_fixed_costs')
        .select('*')
        .eq('company_id', companyId!)
        .eq('deleted', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectFixedCost[];
    },
    {
      stores: [stores.project_fixed_costs],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-project-fixed-costs:${companyId}`,
    },
  );
}

export function useProjectFixedCostMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.project_fixed_costs);

  const create = useCallback(
    (input: TablesInsert<'project_fixed_costs'>) => insert(input),
    [insert],
  );
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'project_fixed_costs'>) => update(id, updates),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { create, update: patch, remove, isPending: isLoading, error };
}
