import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchCompanyProjectMembers, fetchProjectMembers } from '@chrono/sdk';
import type { ProjectMember, ProjectMemberWithProfile, TablesInsert } from '@chrono/sdk';

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

/** All project-member rows across a company's projects — used to resolve each
 * freelancer's effective day rate without a per-project fetch (e.g. valuing
 * uninvoiced time on the company-wide reports screen). */
export function useCompanyProjectMembers(companyId: string | undefined) {
  return linkedQuery<ProjectMember[]>(
    () => fetchCompanyProjectMembers(globalSupabaseClient, companyId!),
    {
      stores: [stores.project_members],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-project-members:${companyId}`,
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
