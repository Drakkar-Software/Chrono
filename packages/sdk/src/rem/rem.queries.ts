import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import { monthKey } from '../time-entry/time-entry.lib';

type Client = SupabaseClient<Database>;

export type RemMonth = Database['public']['Tables']['rem_months']['Row'];
export type RemLine = Database['public']['Tables']['rem_lines']['Row'];
export type CompanyFeeReserve =
  Database['public']['Tables']['company_fee_reserve_ledger']['Row'];
export type JungleQueueEntry =
  Database['public']['Tables']['jungle_tjm_queue_entries']['Row'];

/** Compute (or recompute) rem lines for a company month. Returns rem_months.id. */
export async function computeRemMonth(
  client: Client,
  companyId: string,
  month: string,
): Promise<string> {
  const { data, error } = await client.rpc('compute_rem_month', {
    p_company_id: companyId,
    p_period: monthKey(month),
  });
  if (error) throw error;
  return data as string;
}

/** Lock a computed rem month (no further recompute). */
export async function lockRemMonth(
  client: Client,
  companyId: string,
  month: string,
): Promise<void> {
  const { error } = await client.rpc('lock_rem_month', {
    p_company_id: companyId,
    p_period: monthKey(month),
  });
  if (error) throw error;
}

export async function fetchRemMonth(
  client: Client,
  companyId: string,
  month: string,
): Promise<RemMonth | null> {
  const { data, error } = await client
    .from('rem_months')
    .select('*')
    .eq('company_id', companyId)
    .eq('period_month', monthKey(month))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRemLines(
  client: Client,
  monthId: string,
): Promise<RemLine[]> {
  const { data, error } = await client
    .from('rem_lines')
    .select('*')
    .eq('month_id', monthId)
    .order('bucket')
    .order('amount_cents', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCompanyFeeReserve(
  client: Client,
  companyId: string,
  month?: string,
): Promise<CompanyFeeReserve[]> {
  let q = client
    .from('company_fee_reserve_ledger')
    .select('*')
    .eq('company_id', companyId)
    .order('period_month', { ascending: false });
  if (month) q = q.eq('period_month', monthKey(month));
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchJungleQueue(
  client: Client,
  projectId: string,
): Promise<JungleQueueEntry[]> {
  const { data, error } = await client
    .from('jungle_tjm_queue_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('deleted', false)
    .order('seq');
  if (error) throw error;
  return data ?? [];
}
