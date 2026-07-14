import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import { useAuthCallback } from '@drakkar.software/anchor';

import { globalSupabaseClient } from '@/lib/supabase';
import { stores } from '@/lib/supabase-stores';
import { fetchProfile } from '@chrono/sdk';
import { Loading } from '@/components/Loading';

/**
 * Consumes Supabase auth tokens from the callback URL, establishes a session,
 * then routes by onboarding state. Web reads the hash from `window.location`;
 * native reads the deep-link URL.
 */
export default function AuthCallback() {
  const router = useRouter();
  const nativeUrl = useURL();

  useAuthCallback(globalSupabaseClient, stores.auth, {
    getUrl: () =>
      Platform.OS === 'web'
        ? typeof window !== 'undefined'
          ? window.location.href
          : null
        : nativeUrl,
    routes: {},
    redirect: (path: string) => router.replace(path as never),
    onSuccess: async ({ session }: { session: { user: { id: string } } }) => {
      const profile = await fetchProfile(globalSupabaseClient, session.user.id).catch(
        () => null,
      );
      router.replace(profile?.onboarded ? '/(app)' : '/(onboarding)/role');
    },
    onError: () => {
      router.replace('/(landing)/login');
    },
  });

  return <Loading />;
}
