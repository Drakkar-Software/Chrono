import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProjectExpenses } from '@chrono/sdk';
import type { ProjectExpense, TablesInsert, TablesUpdate } from '@chrono/sdk';

export function useProjectExpenses(projectId: string | undefined, companyId: string | undefined) {
  return linkedQuery<ProjectExpense[]>(
    () => fetchProjectExpenses(globalSupabaseClient, { companyId: companyId!, projectId }),
    {
      stores: [stores.project_expenses],
      enabled: !!projectId && !!companyId,
      deps: [projectId, companyId],
      staleTime: 30_000,
      queryKey: `project-expenses:${projectId}`,
    },
  );
}

/** All (non-deleted) expenses for a company, for reports/P&L — mirrors useCompanyProjectFixedCosts. */
export function useCompanyExpenses(companyId: string | undefined) {
  return linkedQuery<ProjectExpense[]>(
    () => fetchProjectExpenses(globalSupabaseClient, { companyId: companyId! }),
    {
      stores: [stores.project_expenses],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 30_000,
      queryKey: `company-expenses:${companyId}`,
    },
  );
}

export function usePendingExpenses(companyId: string | undefined) {
  return linkedQuery<ProjectExpense[]>(
    () => fetchProjectExpenses(globalSupabaseClient, { companyId: companyId!, status: 'pending' }),
    {
      stores: [stores.project_expenses],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 30_000,
      queryKey: `pending-expenses:${companyId}`,
    },
  );
}

export function useExpenseMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.project_expenses);

  const create = useCallback((input: TablesInsert<'project_expenses'>) => insert(input), [insert]);
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'project_expenses'>) => update(id, updates),
    [update],
  );
  const approve = useCallback((id: string) => update(id, { status: 'approved' }), [update]);
  const reject = useCallback(
    (id: string, reason: string) => update(id, { status: 'rejected', rejection_reason: reason }),
    [update],
  );
  const markReimbursed = useCallback(
    (id: string, reimbursedBy: string) =>
      update(id, { reimbursed_at: new Date().toISOString(), reimbursed_by: reimbursedBy }),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { create, update: patch, approve, reject, markReimbursed, remove, isPending: isLoading, error };
}
