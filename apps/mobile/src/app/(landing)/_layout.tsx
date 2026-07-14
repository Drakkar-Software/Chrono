import { Redirect, Stack } from 'expo-router';
import { useAppAuth } from '@/lib/supabase-stores';

/** Public routes. Redirects into the app once a session exists. */
export default function LandingLayout() {
  const { session, isLoading } = useAppAuth();
  if (!isLoading && session) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
