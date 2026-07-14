import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { AuditEntry } from './audit.entity';

type Client = SupabaseClient<Database>;

/** Company audit log (managers only, per RLS), newest first. */
export async function fetchAuditLog(
  client: Client,
  companyId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const { data, error } = await client
    .from('audit_log')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}
