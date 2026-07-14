import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { registerForPush, unregisterForPush } from '@/lib/push';
import { notificationTarget } from '@/lib/notification-target';

/**
 * Registers this device for push when a user signs in, unregisters on sign-out,
 * and deep-links when the user taps an OS notification. Native-only in effect
 * (the push module and listener no-op / are skipped on web). Registration runs
 * once per user id — guarded so a re-render doesn't re-register.
 */
export function usePushRegistration(userId: string | undefined) {
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (userId && registeredFor.current !== userId) {
      registeredFor.current = userId;
      void registerForPush(userId);
    } else if (!userId && registeredFor.current) {
      registeredFor.current = null;
      void unregisterForPush();
    }
  }, [userId]);

  // Route to the relevant screen when a system notification is tapped.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | undefined;
    let active = true;
    (async () => {
      const Notifications = await import('expo-notifications');
      if (!active) return;
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const target = notificationTarget(response.notification.request.content.data);
        if (target) router.push(target as never);
      });
    })();
    return () => {
      active = false;
      sub?.remove();
    };
  }, [router]);
}
