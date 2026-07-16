import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, ThemeProvider, Txt, spacing, useTheme } from '@chrono/ui';
import { ActiveCompanyProvider, useActiveCompany } from '@/lib/active-company-context';
import { ThemePrefProvider, useThemePref } from '@/lib/theme-pref';
import { I18nProvider } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { usePushRegistration } from '@/lib/hooks/use-push';
import { useInviteMutations } from '@/lib/hooks/use-invites';
import { clearPendingInvite, getPendingInvite } from '@/lib/pending-invite';
import { companyAppUserId } from '@/lib/revenuecat-constants';
import { configureRevenueCat, subscribeCustomerInfo } from '@/lib/revenuecat';
import { setIsProLive } from '@/lib/revenuecat-live-state';

// Keep the splash up until auth resolves (see the effect below).
void SplashScreen.preventAutoHideAsync();

function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fallback, { backgroundColor: colors.canvas }]}>
      <Txt variant="title" center>
        Something went wrong
      </Txt>
      <Txt variant="body" tone="textMuted" center style={styles.fallbackMessage}>
        {error.message || 'The app hit an unexpected error.'}
      </Txt>
      <Button
        title="Try again"
        onPress={() => {
          void retry();
        }}
      />
    </View>
  );
}

/**
 * Root render-error boundary (expo-router). A thrown render surfaces a themed
 * fallback with a retry instead of a blank white screen. Self-wraps in
 * `ThemeProvider` since the failing tree's providers may not be mounted.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorFallback {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const { isLoading, user } = useAppAuth();
  usePushRegistration(user?.id);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemePrefProvider>
          <ThemedApp />
        </ThemePrefProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

/** Applies the persisted theme preference to the UI ThemeProvider. */
function ThemedApp() {
  const { scheme } = useThemePref();
  return (
    <ThemeProvider scheme={scheme}>
      <StatusBar style="auto" />
      <I18nProvider>
        <ActiveCompanyProvider>
          <PendingInviteRedeemer />
          <RevenueCatInitializer />
          <Stack screenOptions={{ headerShown: false }} />
        </ActiveCompanyProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

/**
 * Redeems an invite token stashed before login (see `join.tsx`) once the user
 * is signed in, then switches to the joined company. Runs once per session.
 */
function PendingInviteRedeemer() {
  const { user } = useAppAuth();
  const { accept } = useInviteMutations();
  const { refresh, setCompanyId } = useActiveCompany();
  const handled = useRef(false);

  useEffect(() => {
    if (!user?.id || handled.current) return;
    handled.current = true;
    (async () => {
      const token = await getPendingInvite();
      if (!token) return;
      try {
        const companyId = await accept(token);
        await refresh();
        setCompanyId(companyId);
        await clearPendingInvite();
      } catch (e) {
        // Seat limit hit (enforce_seat_limit_trigger) is recoverable once the
        // company frees a seat or upgrades — keep the token so this retries
        // on next launch instead of discarding an otherwise-valid invite.
        // Any other failure (used/expired/invalid) is not recoverable, so
        // clear it — a bad token must not retry every launch.
        const message = e instanceof Error ? e.message : '';
        if (!message.includes('seat limit')) {
          await clearPendingInvite();
        }
      }
    })();
  }, [user?.id, accept, refresh, setCompanyId]);

  return null;
}

/**
 * Configures RevenueCat under the active COMPANY's app-user-id (not the
 * signed-in user's) — every member of a company purchases into and reads the
 * same entitlement. Re-identifies on company switch and resets the live flag
 * immediately so a fast switch never briefly shows the previous company's Pro
 * status (`applyCustomerInfo`'s `originalAppUserId` guard covers the async race).
 */
function RevenueCatInitializer() {
  const { companyId } = useActiveCompany();

  useEffect(() => {
    if (!companyId) return;
    setIsProLive(false);
    configureRevenueCat(companyAppUserId(companyId));
    return subscribeCustomerInfo();
  }, [companyId]);

  return null;
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  fallbackMessage: { maxWidth: 360 },
});
