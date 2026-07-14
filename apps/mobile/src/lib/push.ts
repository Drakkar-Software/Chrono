import { Platform } from 'react-native';

import { globalSupabaseClient } from '@/lib/supabase';
import { registerDeviceToken, unregisterDeviceToken } from '@chrono/sdk';

/**
 * Push-notification registration. Native-only: web is a no-op (no Expo push
 * token off-device). Modules are dynamically imported so `expo-notifications`
 * and `expo-device` never enter the web bundle.
 */

// The last token we registered, so we can clean it up on sign-out.
let currentToken: string | null = null;

/**
 * Ask for permission, obtain the Expo push token, and store it against the user.
 * Silently does nothing on web, on simulators, or when permission is denied.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = await import('expo-notifications');
  const Device = await import('expo-device');
  const Constants = (await import('expo-constants')).default;

  // Simulators/emulators cannot receive a real push token.
  if (!Device.isDevice) return;

  // Show foreground notifications as banners.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  if (!token) return;

  currentToken = token;
  await registerDeviceToken(globalSupabaseClient, userId, token, Platform.OS);
}

/** Remove this device's push token (on sign-out). No-op on web. */
export async function unregisterForPush(): Promise<void> {
  if (Platform.OS === 'web' || !currentToken) return;
  const token = currentToken;
  currentToken = null;
  try {
    await unregisterDeviceToken(globalSupabaseClient, token);
  } catch {
    // Best-effort: a failed cleanup shouldn't block sign-out.
  }
}
