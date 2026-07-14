import 'react-native-url-polyfill/auto'; // required by supabase-js

import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@chrono/sdk/schema';
import { deleteItem, getItem, setItem } from './storage';

// SecureStore has a 2048-byte limit; strip the heavy metadata before persisting.
// https://github.com/supabase/supabase-js/issues/ (SecureStore size limit)
function removeUserMetaData(itemValue: string): string {
  const parsed = JSON.parse(itemValue);
  if (parsed) {
    delete parsed.user?.identities;
    delete parsed.user?.user_metadata;
  }
  return JSON.stringify(parsed);
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => getItem(key),
  setItem: (key: string, value: string) => setItem(key, removeUserMetaData(value)),
  removeItem: (key: string) => deleteItem(key),
};

export const globalSupabaseClient = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : (ExpoSecureStoreAdapter as any),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
