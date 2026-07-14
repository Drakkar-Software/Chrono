import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@chrono/ui';
import { ActiveCompanyProvider } from '@/lib/active-company-context';
import { useAppAuth } from '@/lib/supabase-stores';

// Keep the splash up until auth resolves (see the effect below).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isLoading } = useAppAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <ActiveCompanyProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ActiveCompanyProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
