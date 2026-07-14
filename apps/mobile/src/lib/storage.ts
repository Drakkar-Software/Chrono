import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// SecureStore on native (encrypted); AsyncStorage on web.
export function getItem(key: string, disableSecureStore = false): Promise<string | null> {
  if (Platform.OS === 'web' || disableSecureStore) {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export function setItem(key: string, value: string, disableSecureStore = false): Promise<void> {
  if (Platform.OS === 'web' || disableSecureStore) {
    return AsyncStorage.setItem(key, value);
  }
  return SecureStore.setItemAsync(key, value);
}

export function deleteItem(key: string, disableSecureStore = false): Promise<void> {
  if (Platform.OS === 'web' || disableSecureStore) {
    return AsyncStorage.removeItem(key);
  }
  return SecureStore.deleteItemAsync(key);
}
