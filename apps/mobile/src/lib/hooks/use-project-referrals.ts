import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchCompanyProjectReferrals, fetchProjectReferrals } from '@chrono/sdk';
import type { ProjectReferral, ProjectReferralWithProfile, TablesInsert } from '@chrono/sdk';

export function useProjectReferrals(projectId: string | undefined) {
  return linkedQuery<ProjectReferralWithProfile[]>(
    () => fetchProjectReferrals(globalSupabaseClient, projectId!),
    {
      stores: [stores.project_referrals],
      enabled: !!projectId,
      deps: [projectId],
      staleTime: 60_000,
      queryKey: `project-referrals:${projectId}`,
    },
  );
}

/** Active referrers across a company's projects — gates referral P&L tiles. */
export function useCompanyProjectReferrals(companyId: string | undefined) {
  return linkedQuery<ProjectReferral[]>(
    () => fetchCompanyProjectReferrals(globalSupabaseClient, companyId!),
    {
      stores: [stores.project_referrals],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-project-referrals:${companyId}`,
    },
  );
}

export function useProjectReferralMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.project_referrals);

  const add = useCallback(
    (input: TablesInsert<'project_referrals'>) => insert(input),
    [insert],
  );
  const updatePercent = useCallback(
    (id: string, percent: number) => update(id, { percent }),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { add, updatePercent, remove, isPending: isLoading, error };
}
