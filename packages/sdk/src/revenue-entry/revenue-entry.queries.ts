import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import { monthKey } from '../time-entry/time-entry.lib';
import type { RevenueEntry, RevenueEntryFilters } from './revenue-entry.entity';

type Client = SupabaseClient<Database>;

export async function fetchRevenueEntries(
  client: Client,
  projectId: string,
  filters?: RevenueEntryFilters,
): Promise<RevenueEntry[]> {
  let query = client
    .from('revenue_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('deleted', false)
    .order('period_month', { ascending: false });

  if (filters?.type) query = query.eq('type', filters.type);
  if (filters?.from) query = query.gte('period_month', filters.from);
  if (filters?.to) query = query.lte('period_month', filters.to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RevenueEntry[];
}

export async function fetchRevenueForMonth(
  client: Client,
  projectId: string,
  month: string,
): Promise<RevenueEntry[]> {
  const { data, error } = await client
    .from('revenue_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('period_month', monthKey(month))
    .eq('deleted', false);
  if (error) throw error;
  return (data ?? []) as RevenueEntry[];
}

/** Recognize a project's revenue for a month (RPC upserts revenue_entries). */
export async function recognizeRevenue(
  client: Client,
  projectId: string,
  month: string,
): Promise<void> {
  const { error } = await client.rpc('recognize_project_revenue', {
    p_project_id: projectId,
    p_period: monthKey(month),
  });
  if (error) throw error;
}

/**
 * Mark one or more revenue entries paid (or back to due). Manager-only,
 * scoped server-side to the entries' own company. Pass every due entry's id
 * to bulk-mark a project's history paid at once.
 */
export async function markRevenueEntriesPaid(
  client: Client,
  entryIds: string[],
  paid = true,
): Promise<void> {
  const { error } = await client.rpc('mark_revenue_entries_paid', {
    p_entry_ids: entryIds,
    p_paid: paid,
  });
  if (error) throw error;
}
