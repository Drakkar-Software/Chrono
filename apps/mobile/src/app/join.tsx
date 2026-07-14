import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StackScreen, Txt } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useInviteMutations } from '@/lib/hooks/use-invites';
import { setPendingInvite } from '@/lib/pending-invite';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { tokenFromInput } from '@/components/settings/JoinCompanyForm';

/**
 * Deep-link target for invite links (`/join?token=…`). Redeems the token for a
 * signed-in user, then routes into the app. Signed-out users have the token
 * stashed and are sent to log in — it's redeemed automatically once they land
 * (see `usePendingInviteRedemption`).
 */
export default function JoinScreen() {
  const router = useRouter();
  const { token: rawToken } = useLocalSearchParams<{ token?: string }>();
  const token = tokenFromInput(rawToken ?? '');
  const { session, isLoading } = useAppAuth();
  const { accept } = useInviteMutations();

  const [error, setError] = useState<unknown>(null);
  // Bumping this re-runs the redeem effect (a plain ref guard can't be retried).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLoading || !token) return;

    if (!session) {
      // Signed out: keep the token for after login, then send them to sign in.
      void setPendingInvite(token);
      router.replace('/(landing)/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await accept(token);
        if (!cancelled) router.replace('/(app)/(tabs)/settings');
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, session, token, accept, router, attempt]);

  if (isLoading) return <ScreenLoader />;

  return (
    <StackScreen title="Joining…" onBack={() => router.replace('/(app)')}>
      {!token ? (
        <Txt tone="textMuted">This invite link is missing its code.</Txt>
      ) : error ? (
        <ErrorState
          error={error}
          title="Couldn't join"
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <ScreenLoader />
      )}
    </StackScreen>
  );
}
