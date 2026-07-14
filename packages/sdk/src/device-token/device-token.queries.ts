import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';

type Client = SupabaseClient<Database>;

/**
 * Register (or refresh) an Expo push token for a user. Idempotent on the token:
 * a token already owned by this user just bumps `updated_at`.
 */
export async function registerDeviceToken(
  client: Client,
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  const { error } = await client
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
  if (error) throw error;
}

/** Remove a push token (on sign-out or when Expo reports it invalid). */
export async function unregisterDeviceToken(
  client: Client,
  token: string,
): Promise<void> {
  const { error } = await client.from('device_tokens').delete().eq('token', token);
  if (error) throw error;
}
