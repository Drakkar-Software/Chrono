import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import { monthKey } from '../time-entry/time-entry.lib';
import type {
  ReferralEarning,
  ReferralEarningFilters,
} from './referral-earning.entity';

type Client = SupabaseClient<Database>;

export async function fetchReferralEarnings(
  client: Client,
  filters: ReferralEarningFilters,
): Promise<ReferralEarning[]> {
  let query = client
    .from('referral_earnings')
    .select('*')
    .eq('deleted', false)
    .order('period_month', { ascending: false });

  if (filters.referrerId) query = query.eq('referrer_id', filters.referrerId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.companyId) query = query.eq('company_id', filters.companyId);
  if (filters.month) query = query.eq('period_month', monthKey(filters.month));

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReferralEarning[];
}

export async function fetchMyReferralEarnings(
  client: Client,
  userId: string,
  companyId: string,
): Promise<ReferralEarning[]> {
  return fetchReferralEarnings(client, { referrerId: userId, companyId });
}
