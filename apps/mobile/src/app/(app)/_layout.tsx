import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useResponsive } from '@chrono/ui';
import { useAppAuth } from '@/lib/supabase-stores';
import { useProfile } from '@/lib/hooks/use-profile';
import { Loading } from '@/components/Loading';
import { DesktopSidebar } from '@/components/nav/DesktopSidebar';

/**
 * Authenticated gate. Waits for auth to resolve, redirects signed-out users to
 * the landing group, and sends not-yet-onboarded users into onboarding. On wide
 * web it frames every app screen with the persistent desktop sidebar (the bottom
 * tab bar is hidden there — see the tabs layout); phones/native keep the tabs.
 */
export default function AppLayout() {
  const { session, isLoading } = useAppAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { isWide } = useResponsive();
  const useSidebar = Platform.OS === 'web' && isWide;

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/(landing)/login" />;
  if (profileLoading && profile === undefined) return <Loading />;
  if (profile && !profile.onboarded) return <Redirect href="/(onboarding)/role" />;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="project/[id]" />
      <Stack.Screen name="invoice/[id]" />
      <Stack.Screen name="time-entry/[id]" />
    </Stack>
  );

  if (!useSidebar) return stack;

  return (
    <View style={styles.shell}>
      <DesktopSidebar />
      <View style={styles.main}>{stack}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
});
