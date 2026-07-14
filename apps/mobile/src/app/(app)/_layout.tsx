import { Redirect, Stack } from 'expo-router';
import { useAppAuth } from '@/lib/supabase-stores';
import { useProfile } from '@/lib/hooks/use-profile';
import { Loading } from '@/components/Loading';

/**
 * Authenticated gate. Waits for auth to resolve, redirects signed-out users to
 * the landing group, and sends not-yet-onboarded users into onboarding.
 */
export default function AppLayout() {
  const { session, isLoading } = useAppAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/(landing)/login" />;
  if (profileLoading && profile === undefined) return <Loading />;
  if (profile && !profile.onboarded) return <Redirect href="/(onboarding)/role" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="project/[id]" />
      <Stack.Screen name="invoice/[id]" />
      <Stack.Screen name="time-entry/[id]" />
    </Stack>
  );
}
