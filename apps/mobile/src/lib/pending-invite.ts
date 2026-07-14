import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A pending invite token, stashed when a signed-out user opens an invite link
 * so it survives the trip through login and can be redeemed once they're in.
 */
const KEY = 'chrono.pendingInviteToken';

export async function setPendingInvite(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // Non-fatal: worst case the user re-pastes the link in Settings.
  }
}

export async function getPendingInvite(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
