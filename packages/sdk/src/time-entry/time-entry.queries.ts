import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type {
  TimeEntry,
  TimeEntryFilters,
  TimeEntryWithProject,
} from './time-entry.entity';
import { monthBounds, weekBounds } from './time-entry.lib';

type Client = SupabaseClient<Database>;

export const TIME_ENTRY_SELECT = `
  *,
  project:projects(name, color, hours_per_day)
` as const;

export async function fetchTimeEntries(
  client: Client,
  filters: TimeEntryFilters,
): Promise<TimeEntryWithProject[]> {
  let query = client
    .from('time_entries')
    .select(TIME_ENTRY_SELECT)
    .eq('company_id', filters.companyId)
    .eq('deleted', false)
    .order('entry_date', { ascending: false });

  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.billable !== undefined)
    query = query.eq('billable', filters.billable);
  if (filters.from) query = query.gte('entry_date', filters.from);
  if (filters.to) query = query.lte('entry_date', filters.to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TimeEntryWithProject[];
}

/** A single time entry by id (with its project join), or null if not found. */
export async function fetchTimeEntry(
  client: Client,
  id: string,
): Promise<TimeEntryWithProject | null> {
  const { data, error } = await client
    .from('time_entries')
    .select(TIME_ENTRY_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as TimeEntryWithProject | null;
}

export async function fetchWeekEntries(
  client: Client,
  userId: string,
  companyId: string,
  weekStartISO: string,
): Promise<TimeEntryWithProject[]> {
  const { start, end } = weekBounds(weekStartISO);
  return fetchTimeEntries(client, {
    companyId,
    userId,
    from: start,
    to: end,
  });
}

export async function fetchPendingApprovals(
  client: Client,
  companyId: string,
): Promise<TimeEntryWithProject[]> {
  return fetchTimeEntries(client, { companyId, status: 'pending' });
}

/** Approved, billable, not-yet-invoiced entries for one freelancer/project/month. */
export async function fetchMonthEntriesForInvoice(
  client: Client,
  params: { projectId: string; userId: string; month: string },
): Promise<TimeEntry[]> {
  const { start, end } = monthBounds(params.month);
  const { data, error } = await client
    .from('time_entries')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .eq('status', 'approved')
    .eq('billable', true)
    .is('invoice_id', null)
    .eq('deleted', false)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .order('entry_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function createTimeEntry(
  client: Client,
  input: TablesInsert<'time_entries'>,
): Promise<TimeEntry> {
  const { data, error } = await client
    .from('time_entries')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function updateTimeEntry(
  client: Client,
  id: string,
  patch: TablesUpdate<'time_entries'>,
): Promise<TimeEntry> {
  const { data, error } = await client
    .from('time_entries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function deleteTimeEntry(
  client: Client,
  id: string,
): Promise<TimeEntry> {
  const { data, error } = await client
    .from('time_entries')
    .update({ deleted: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function approveTimeEntry(
  client: Client,
  id: string,
): Promise<TimeEntry> {
  const { data, error } = await client
    .from('time_entries')
    .update({ status: 'approved' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function rejectTimeEntry(
  client: Client,
  id: string,
  reason: string,
): Promise<TimeEntry> {
  const { data, error } = await client
    .from('time_entries')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}
