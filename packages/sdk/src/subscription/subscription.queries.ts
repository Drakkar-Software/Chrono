import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { CompanySubscription } from './subscription.entity';

type Client = SupabaseClient<Database>;

/**
 * The company's billing state. Every company gets one at creation time (see
 * the `on_company_created_start_trial` trigger), so this is only null for a
 * company that predates the trigger or hasn't loaded yet.
 */
export async function fetchCompanySubscription(
  client: Client,
  companyId: string,
): Promise<CompanySubscription | null> {
  const { data, error } = await client
    .from('company_subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
