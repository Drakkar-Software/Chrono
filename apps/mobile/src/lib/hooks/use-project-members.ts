import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProjectMembers } from '@chrono/sdk';
import type { ProjectMemberWithProfile, TablesInsert } from '@chrono/sdk';

export function useProjectMembers(projectId: string | undefined) {
  return useLinkedQuery(
    () => fetchProjectMembers(globalSupabaseClient, projectId!),
    {
      stores: [stores.project_members],
      enabled: !!projectId,
      deps: [projectId],
      mergeToStore: stores.project_members,
      staleTime: 60_000,
      queryKey: `project-members:${projectId}`,
    },
  ) as { data: ProjectMemberWithProfile[] | undefined; isLoading: boolean; error: unknown };
}

export function useProjectMemberMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.project_members);

  const add = useCallback(
    (input: TablesInsert<'project_members'>) => insert(input),
    [insert],
  );
  const updateTjm = useCallback(
    (id: string, tjmCents: number | null) => update(id, { tjm_cents: tjmCents }),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { add, updateTjm, remove, isPending: isLoading, error };
}
