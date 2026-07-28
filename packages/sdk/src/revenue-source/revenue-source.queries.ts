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
    .order('invoiced_at', { ascending: false });
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

/**
 * Soft-delete a revenue source. Prefer {@link correctRevenueSource} so history
 * is kept and recognized amounts are offset with negative entries.
 */
export async function deactivateRevenueSource(
  client: Client,
  id: string,
): Promise<RevenueSource> {
  const { data, error } = await client
    .from('revenue_sources')
    .update({ deleted: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as RevenueSource;
}

/**
 * Deactivate a revenue source and insert offsetting negative revenue_entries
 * for each period with positive net — keeps history (does not soft-delete).
 */
export async function correctRevenueSource(
  client: Client,
  sourceId: string,
): Promise<void> {
  const { error } = await client.rpc('correct_revenue_source', {
    p_source_id: sourceId,
  });
  if (error) throw error;
}
