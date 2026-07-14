import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProjectMembers } from '@chrono/sdk';
import type { ProjectMemberWithProfile, TablesInsert } from '@chrono/sdk';

export function useProjectMembers(projectId: string | undefined) {
  return linkedQuery<ProjectMemberWithProfile[]>(
    () => fetchProjectMembers(globalSupabaseClient, projectId!),
    {
      stores: [stores.project_members],
      enabled: !!projectId,
      deps: [projectId],
      staleTime: 60_000,
      queryKey: `project-members:${projectId}`,
    },
  );
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
