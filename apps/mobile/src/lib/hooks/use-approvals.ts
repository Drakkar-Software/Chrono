import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchPendingApprovals } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';

export function usePendingApprovals(companyId: string | undefined) {
  return useLinkedQuery(
    () => fetchPendingApprovals(globalSupabaseClient, companyId!),
    {
      stores: [stores.time_entries],
      enabled: !!companyId,
      deps: [companyId],
      mergeToStore: stores.time_entries,
      staleTime: 30_000,
      queryKey: `pending-approvals:${companyId}`,
    },
  ) as {
    data: TimeEntryWithProject[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => Promise<void>;
  };
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
