import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { unreadCount } from '@chrono/sdk';
import type { Notification } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useNotifications } from '@/lib/hooks/use-notifications';

interface NotificationsValue {
  notifications: Notification[];
  unread: number;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * Mounts the notifications feed query ONCE for the signed-in user and shares it.
 *
 * `useLinkedQuery` merges its result into the notifications store while also
 * subscribing to it; two concurrent instances (sidebar + tab badge + a screen)
 * would each see the other's merge as an external change and refetch forever.
 * A single shared instance behind this provider avoids that loop.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAppAuth();
  const { data, isLoading, error, refetch } = useNotifications(user?.id);
  const notifications = data ?? [];

  const value = useMemo<NotificationsValue>(
    () => ({ notifications, unread: unreadCount(notifications), isLoading, error, refetch }),
    [notifications, isLoading, error, refetch],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** Read the shared notifications feed. Returns empty defaults outside a provider. */
export function useNotificationsFeed(): NotificationsValue {
  return (
    useContext(NotificationsContext) ?? {
      notifications: [],
      unread: 0,
      isLoading: false,
      error: null,
      refetch: async () => {},
    }
  );
}
