import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type { RevenueSource } from './revenue-source.entity';

type Client = SupabaseClient<Database>;

export async function fetchRevenueSources(
  client: Client,
  projectId: string,
): Promise<RevenueSource[]> {
  const { data, error } = await client
    .from('revenue_sources')
    .select('*')
    .eq('project_id', projectId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RevenueSource[];
}

export async function createRevenueSource(
  client: Client,
  input: TablesInsert<'revenue_sources'>,
): Promise<RevenueSource> {
  const { data, error } = await client
    .from('revenue_sources')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as RevenueSource;
}

export async function updateRevenueSource(
  client: Client,
  id: string,
  patch: TablesUpdate<'revenue_sources'>,
): Promise<RevenueSource> {
  const { data, error } = await client
    .from('revenue_sources')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as RevenueSource;
}

export async function deactivateRevenueSource(
  client: Client,
  id: string,
): Promise<RevenueSource> {
  const { data, error } = await client
    .from('revenue_sources')
    .update({ active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as RevenueSource;
}
