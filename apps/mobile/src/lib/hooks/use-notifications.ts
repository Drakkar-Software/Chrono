import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchNotifications } from '@chrono/sdk';
import type { Notification } from '@chrono/sdk';

/** A user's notification feed (newest first), offline-first. */
export function useNotifications(userId: string | undefined) {
  return linkedQuery<Notification[]>(() => fetchNotifications(globalSupabaseClient, userId!), {
    stores: [stores.notifications],
    enabled: !!userId,
    deps: [userId],
    staleTime: 30_000,
    queryKey: `notifications:${userId}`,
  });
}

export function useNotificationMutations(userId: string | undefined) {
  const { update, isLoading, error } = useMutation(stores.notifications);

  const markRead = useCallback(
    (id: string) => update(id, { read_at: new Date().toISOString() }),
    [update],
  );
  const dismiss = useCallback((id: string) => update(id, { deleted: true }), [update]);
  // Mark a batch read through the store so the offline cache stays consistent.
  const markAllRead = useCallback(
    async (ids: string[]) => {
      const now = new Date().toISOString();
      await Promise.all(ids.map((id) => update(id, { read_at: now })));
    },
    [update],
  );

  return { markRead, dismiss, markAllRead, isPending: isLoading, error };
}
