import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProjectCosts, markProjectCostsPaid } from '@chrono/sdk';
import type { ProjectCost, TablesInsert, TablesUpdate } from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

export function useProjectCosts(projectId: string | undefined, companyId: string | undefined) {
  return linkedQuery<ProjectCost[]>(
    () => fetchProjectCosts(globalSupabaseClient, { companyId: companyId!, projectId }),
    {
      stores: [stores.project_costs],
      enabled: !!projectId && !!companyId,
      deps: [projectId, companyId],
      staleTime: 30_000,
      queryKey: `project-costs:${projectId}`,
    },
  );
}

/**
 * All (non-deleted) costs for a company in ONE round-trip, for the reports P&L
 * which groups by project client-side — mirrors `useCompanyRevenueEntries`
 * (avoids a per-project fan-out).
 */
export function useCompanyProjectCosts(companyId: string | undefined) {
  return linkedQuery<ProjectCost[]>(
    () => fetchProjectCosts(globalSupabaseClient, { companyId: companyId! }),
    {
      stores: [stores.project_costs],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 30_000,
      queryKey: `company-project-costs:${companyId}`,
    },
  );
}

/** Pending reimbursables awaiting review — powers the approvals screen. */
export function usePendingExpenses(companyId: string | undefined) {
  return linkedQuery<ProjectCost[]>(
    () =>
      fetchProjectCosts(globalSupabaseClient, {
        companyId: companyId!,
        kind: 'reimbursable',
        status: 'pending',
      }),
    {
      stores: [stores.project_costs],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 30_000,
      queryKey: `pending-expenses:${companyId}`,
    },
  );
}

export function useProjectCostMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.project_costs);

  const create = useCallback((input: TablesInsert<'project_costs'>) => insert(input), [insert]);
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'project_costs'>) => update(id, updates),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);
  const approve = useCallback((id: string) => update(id, { status: 'approved' }), [update]);
  const reject = useCallback(
    (id: string, reason: string) => update(id, { status: 'rejected', rejection_reason: reason }),
    [update],
  );
  const markReimbursed = useCallback(
    (id: string, by: string) =>
      update(id, { reimbursed_at: new Date().toISOString(), reimbursed_by: by }),
    [update],
  );

  return {
    create,
    update: patch,
    remove,
    approve,
    reject,
    markReimbursed,
    isPending: isLoading,
    error,
  };
}

/**
 * Mark one or more pool costs paid (or back to unpaid). Manager-only (RPC) —
 * the manager check and the reimbursable guard live server-side, so this can't
 * be a plain column update. Mirrors `useMarkRevenueEntriesPaid`.
 */
export function useMarkProjectCostsPaid() {
  return useAsyncAction((costIds: string[], paid: boolean) =>
    markProjectCostsPaid(globalSupabaseClient, costIds, paid),
  );
}
