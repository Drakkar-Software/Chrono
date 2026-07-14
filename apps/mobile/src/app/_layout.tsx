import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, ThemeProvider, Txt, spacing, useTheme } from '@chrono/ui';
import { ActiveCompanyProvider } from '@/lib/active-company-context';
import { ThemePrefProvider, useThemePref } from '@/lib/theme-pref';
import { useAppAuth } from '@/lib/supabase-stores';
import { usePushRegistration } from '@/lib/hooks/use-push';

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
      <ActiveCompanyProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ActiveCompanyProvider>
    </ThemeProvider>
  );
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
