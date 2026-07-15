import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type { ProjectFixedCost } from './project-fixed-cost.entity';

type Client = SupabaseClient<Database>;

export async function fetchProjectFixedCosts(
  client: Client,
  projectId: string,
): Promise<ProjectFixedCost[]> {
  const { data, error } = await client
    .from('project_fixed_costs')
    .select('*')
    .eq('project_id', projectId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectFixedCost[];
}

export async function createProjectFixedCost(
  client: Client,
  input: TablesInsert<'project_fixed_costs'>,
): Promise<ProjectFixedCost> {
  const { data, error } = await client
    .from('project_fixed_costs')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectFixedCost;
}

export async function updateProjectFixedCost(
  client: Client,
  id: string,
  patch: TablesUpdate<'project_fixed_costs'>,
): Promise<ProjectFixedCost> {
  const { data, error } = await client
    .from('project_fixed_costs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectFixedCost;
}

export async function removeProjectFixedCost(
  client: Client,
  id: string,
): Promise<ProjectFixedCost> {
  const { data, error } = await client
    .from('project_fixed_costs')
    .update({ deleted: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectFixedCost;
}
