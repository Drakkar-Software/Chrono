import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { EmptyState, useResponsive } from '@chrono/ui';
import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useProfile } from '@/lib/hooks/use-profile';
import { useActiveCompany } from '@/lib/active-company-context';
import { useChronoPro } from '@/lib/hooks/use-subscription';
import { Loading } from '@/components/Loading';
import { DesktopSidebar } from '@/components/nav/DesktopSidebar';
import { NotificationsProvider } from '@/lib/notifications-context';

// Routes exempt from the Chrono Pro gate below — the gate itself, and the
// place an admin resolves it, must always be reachable.
const BILLING_ROUTES = ['/settings/billing', '/paywall'];

/**
 * Authenticated gate. Waits for auth to resolve, redirects signed-out users to
 * the landing group, and sends not-yet-onboarded users into onboarding. On wide
 * web it frames every app screen with the persistent desktop sidebar (the bottom
 * tab bar is hidden there — see the tabs layout); phones/native keep the tabs.
 * Once a company's trial/subscription has lapsed, routes an admin to billing
 * and shows everyone else a read-only "ask your admin" screen instead of the app.
 */
export default function AppLayout() {
  const t = useT();
  const pathname = usePathname();
  const { session, isLoading } = useAppAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { companyId, role } = useActiveCompany();
  const { sub, isLoading: subLoading, isPro } = useChronoPro(companyId ?? undefined);
  const { isWide } = useResponsive();
  const useSidebar = Platform.OS === 'web' && isWide;

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/(landing)/login" />;
  if (profileLoading && profile === undefined) return <Loading />;
  if (profile && !profile.onboarded) return <Redirect href="/(onboarding)/role" />;

  const onBillingRoute = BILLING_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`),
  );
  if (!onBillingRoute && companyId && !subLoading && sub && !isPro) {
    if (role === 'admin') return <Redirect href="/settings/billing" />;
    return (
      <EmptyState
        icon="lock-closed-outline"
        title={t('tabs.billing.expiredTitle')}
        subtitle={t('tabs.billing.expiredSubtitleMember')}
        tone="warning"
      />
    );
  }

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="project/[id]" />
      <Stack.Screen name="invoice/[id]" />
      <Stack.Screen name="time-entry/[id]" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );

  return (
    <NotificationsProvider>
      {useSidebar ? (
        <View style={styles.shell}>
          <DesktopSidebar />
          <View style={styles.main}>{stack}</View>
        </View>
      ) : (
        stack
      )}
    </NotificationsProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
});
