import { useEffect, useRef } from 'react';

import { registerForPush, unregisterForPush } from '@/lib/push';

/**
 * Registers this device for push when a user signs in, and unregisters on
 * sign-out. Native-only in effect (the push module no-ops on web). Runs once
 * per user id — guarded so a re-render doesn't re-register.
 */
export function usePushRegistration(userId: string | undefined) {
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
}
