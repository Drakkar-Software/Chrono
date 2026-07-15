import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '../schema';
import type { TimeOff } from './time-off.entity';

type Client = SupabaseClient<Database>;

export type TimeOffFilters = {
  companyId: string;
  userId: string;
  from?: string;
  to?: string;
};

export async function fetchUserTimeOff(
  client: Client,
  filters: TimeOffFilters,
): Promise<TimeOff[]> {
  let query = client
    .from('time_off')
    .select('*')
    .eq('company_id', filters.companyId)
    .eq('user_id', filters.userId)
    .order('off_date', { ascending: true });
  if (filters.from) query = query.gte('off_date', filters.from);
  if (filters.to) query = query.lte('off_date', filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TimeOff[];
}

export async function addTimeOff(
  client: Client,
  input: TablesInsert<'time_off'>,
): Promise<TimeOff> {
  const { data, error } = await client
    .from('time_off')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeOff;
}

export async function removeTimeOff(client: Client, id: string): Promise<void> {
  const { error } = await client.from('time_off').delete().eq('id', id);
  if (error) throw error;
}
