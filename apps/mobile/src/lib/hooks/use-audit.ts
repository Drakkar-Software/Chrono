import { useLinkedQuery } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchAuditLog } from '@chrono/sdk';
import type { AuditEntry } from '@chrono/sdk';

/** A company's audit log (managers only, per RLS), offline-first. */
export function useAuditLog(companyId: string | undefined) {
  return useLinkedQuery(() => fetchAuditLog(globalSupabaseClient, companyId!), {
    stores: [stores.audit_log],
    enabled: !!companyId,
    deps: [companyId],
    mergeToStore: stores.audit_log,
    staleTime: 30_000,
    queryKey: `audit-log:${companyId}`,
  }) as {
    data: AuditEntry[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => Promise<void>;
  };
}
