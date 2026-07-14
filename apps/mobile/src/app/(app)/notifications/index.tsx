import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, StackScreen, spacing } from '@chrono/ui';
import { unreadCount } from '@chrono/sdk';
import type { Notification } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useNotifications, useNotificationMutations } from '@/lib/hooks/use-notifications';
import { usePagination } from '@/lib/hooks/use-pagination';
import { notificationTarget } from '@/lib/notification-target';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadMore } from '@/components/common/LoadMore';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAppAuth();
  const userId = user?.id;

  const { data, isLoading, error, refetch } = useNotifications(userId);
  const { markRead, dismiss, markAllRead } = useNotificationMutations(userId);

  // Filter `deleted` locally so a dismissed row vanishes immediately from the
  // optimistic store update, before the linked query refetches.
  const list = useMemo(() => (data ?? []).filter((n) => !n.deleted), [data]);
  const unread = unreadCount(list);
  const { page, hasMore, loadMore } = usePagination(list, userId ?? '');

  const openNotification = (n: Notification) => {
    if (n.read_at == null) void markRead(n.id);
    const target = notificationTarget(n.data);
    if (target) router.push(target as never);
  };

  const onMarkAll = () => {
    const ids = list.filter((n) => n.read_at == null).map((n) => n.id);
    if (ids.length) void markAllRead(ids);
  };

  const headerRight =
    unread > 0 ? <Button title="Mark all read" size="sm" variant="ghost" onPress={onMarkAll} /> : undefined;

  return (
    <StackScreen title="Notifications" onBack={() => router.back()} headerRight={headerRight}>
      {isLoading && data == null ? (
        <ScreenLoader />
      ) : error && data == null ? (
        <ErrorState
          error={error}
          title="Couldn't load notifications"
          onRetry={() => {
            void refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="No notifications"
          subtitle="Approvals, payments and referral earnings will show up here."
        />
      ) : (
        <View style={styles.list}>
          {page.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onPress={() => openNotification(n)}
              onDismiss={() => void dismiss(n.id)}
            />
          ))}
          <LoadMore hasMore={hasMore} onLoadMore={loadMore} remaining={list.length - page.length} />
        </View>
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
