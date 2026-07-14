import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type { Project, ProjectFilters } from './project.entity';

type Client = SupabaseClient<Database>;

export const PROJECT_SELECT = '*' as const;

export async function fetchProjects(
  client: Client,
  companyId: string,
  filters?: ProjectFilters,
): Promise<Project[]> {
  let query = client
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('company_id', companyId)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    // Strip PostgREST filter metacharacters so a search string can't inject
    // extra `.or()` clauses (comma / dot / parens). Stays within RLS scope
    // regardless, but keep the filter honest.
    const term = filters.search.replace(/[,.()*:]/g, ' ').trim();
    if (term) {
      query = query.or(`name.ilike.%${term}%,client_name.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Project[];
}

/** Projects the user is assigned to within a company. */
export async function fetchMyProjects(
  client: Client,
  userId: string,
  companyId: string,
): Promise<Project[]> {
  const { data, error } = await client
    .from('projects')
    .select('*, project_members!inner(user_id)')
    .eq('project_members.user_id', userId)
    .eq('company_id', companyId)
    .eq('deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Project[];
}

export async function fetchProject(
  client: Client,
  id: string,
): Promise<Project> {
  const { data, error } = await client
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function createProject(
  client: Client,
  input: TablesInsert<'projects'>,
): Promise<Project> {
  const { data, error } = await client
    .from('projects')
    .insert(input)
    .select(PROJECT_SELECT)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  client: Client,
  id: string,
  patch: TablesUpdate<'projects'>,
): Promise<Project> {
  const { data, error } = await client
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select(PROJECT_SELECT)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function archiveProject(
  client: Client,
  id: string,
): Promise<Project> {
  const { data, error } = await client
    .from('projects')
    .update({ deleted: true, status: 'archived' })
    .eq('id', id)
    .select(PROJECT_SELECT)
    .single();
  if (error) throw error;
  return data as Project;
}
