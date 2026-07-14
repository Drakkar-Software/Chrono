import { Redirect, Stack } from 'expo-router';
import { useAppAuth } from '@/lib/supabase-stores';

/** Onboarding requires a session but not a completed profile. */
export default function OnboardingLayout() {
  const { session, isLoading } = useAppAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/(landing)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
