import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StackScreen, Txt } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useInviteMutations } from '@/lib/hooks/use-invites';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { tokenFromInput } from '@/components/settings/JoinCompanyForm';

/**
 * Deep-link target for invite links (`/join?token=…`). Redeems the token for a
 * signed-in user, then routes into the app. Signed-out users are sent to log in
 * first — they can paste the same link under Settings › Join a company after.
 */
export default function JoinScreen() {
  const router = useRouter();
  const { token: rawToken } = useLocalSearchParams<{ token?: string }>();
  const token = tokenFromInput(rawToken ?? '');
  const { session, isLoading } = useAppAuth();
  const { accept } = useInviteMutations();

  const [error, setError] = useState<unknown>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (isLoading || !session || !token || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        await accept(token);
        router.replace('/(app)/(tabs)/settings');
      } catch (e) {
        setError(e);
      }
    })();
  }, [isLoading, session, token, accept, router]);

  if (isLoading) return <ScreenLoader />;
  if (!session) return <Redirect href="/(landing)/login" />;

  return (
    <StackScreen title="Joining…" onBack={() => router.replace('/(app)')}>
      {!token ? (
        <Txt tone="textMuted">This invite link is missing its code.</Txt>
      ) : error ? (
        <ErrorState
          error={error}
          title="Couldn't join"
          onRetry={() => {
            attempted.current = false;
            setError(null);
          }}
        />
      ) : (
        <ScreenLoader />
      )}
    </StackScreen>
  );
}
