import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProjectReferrals } from '@chrono/sdk';
import type { ProjectReferralWithProfile, TablesInsert } from '@chrono/sdk';

export function useProjectReferrals(projectId: string | undefined) {
  return useLinkedQuery(
    () => fetchProjectReferrals(globalSupabaseClient, projectId!),
    {
      stores: [stores.project_referrals],
      enabled: !!projectId,
      deps: [projectId],
      mergeToStore: stores.project_referrals,
      staleTime: 60_000,
      queryKey: `project-referrals:${projectId}`,
    },
  ) as { data: ProjectReferralWithProfile[] | undefined; isLoading: boolean; error: unknown };
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
