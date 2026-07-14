import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

import { useAppAuth } from '@/lib/supabase-stores';

/** Entry redirect: route to the app when authed, otherwise to the landing group. */
export default function Index() {
  const { session, isLoading } = useAppAuth();

  if (isLoading) return null;
  if (session) return <Redirect href="/(app)/(tabs)/home" />;
  return <Redirect href={Platform.OS === 'web' ? '/(landing)' : '/(landing)/login'} />;
}
