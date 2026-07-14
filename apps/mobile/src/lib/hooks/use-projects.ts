import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchMyProjects, fetchProject, fetchProjects } from '@chrono/sdk';
import type { Project, ProjectFilters } from '@chrono/sdk';

/** All company projects (manager view). */
export function useProjects(companyId: string | undefined, filters?: ProjectFilters) {
  return linkedQuery<Project[]>(
    () => fetchProjects(globalSupabaseClient, companyId!, filters),
    {
      stores: [stores.projects],
      enabled: !!companyId,
      deps: [companyId, JSON.stringify(filters)],
      staleTime: 60_000,
      queryKey: `projects:${companyId}:${JSON.stringify(filters)}`,
    },
  );
}

/** Projects the user is assigned to (freelancer view). */
export function useMyProjects(userId: string | undefined, companyId: string | undefined) {
  return linkedQuery<Project[]>(
    () => fetchMyProjects(globalSupabaseClient, userId!, companyId!),
    {
      stores: [stores.projects, stores.project_members],
      enabled: !!userId && !!companyId,
      deps: [userId, companyId],
      staleTime: 60_000,
      queryKey: `my-projects:${userId}:${companyId}`,
    },
  );
}

export function useProject(id: string | undefined) {
  return linkedQuery<Project>(
    () => fetchProject(globalSupabaseClient, id!),
    {
      stores: [stores.projects],
      enabled: !!id,
      deps: [id],
      staleTime: 60_000,
      queryKey: `project:${id}`,
    },
  );
}
