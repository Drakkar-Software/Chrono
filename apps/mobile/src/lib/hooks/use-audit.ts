import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchAuditLog } from '@chrono/sdk';
import type { AuditEntry } from '@chrono/sdk';

/** A company's audit log (managers only, per RLS), offline-first. */
export function useAuditLog(companyId: string | undefined) {
  return linkedQuery<AuditEntry[]>(() => fetchAuditLog(globalSupabaseClient, companyId!), {
    stores: [stores.audit_log],
    enabled: !!companyId,
    deps: [companyId],
    staleTime: 30_000,
    queryKey: `audit-log:${companyId}`,
  });
}
