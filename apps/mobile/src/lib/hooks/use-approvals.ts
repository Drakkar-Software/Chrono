import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchPendingApprovals } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';

export function usePendingApprovals(companyId: string | undefined) {
  return linkedQuery<TimeEntryWithProject[]>(
    () => fetchPendingApprovals(globalSupabaseClient, companyId!),
    {
      // Watches the store for mutation-driven refresh but doesn't mergeToStore —
      // see use-time-entries: two mergers into time_entries would loop.
      stores: [stores.time_entries],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 30_000,
      queryKey: `pending-approvals:${companyId}`,
    },
  );
}

export function useApproveEntry() {
  const { update, isLoading, error } = useMutation(stores.time_entries);
  const mutateAsync = useCallback(
    (id: string) => update(id, { status: 'approved' }),
    [update],
  );
  return { mutateAsync, mutate: (id: string) => void mutateAsync(id), isPending: isLoading, error };
}

export function useRejectEntry() {
  const { update, isLoading, error } = useMutation(stores.time_entries);
  const mutateAsync = useCallback(
    (id: string, reason: string) =>
      update(id, { status: 'rejected', rejection_reason: reason }),
    [update],
  );
  return {
    mutateAsync,
    mutate: (id: string, reason: string) => void mutateAsync(id, reason),
    isPending: isLoading,
    error,
  };
}
