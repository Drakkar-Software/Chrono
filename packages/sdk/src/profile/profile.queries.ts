import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesUpdate } from '../schema';
import type { Profile, ProfileBilling } from './profile.entity';

type Client = SupabaseClient<Database>;

export async function fetchProfile(
  client: Client,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  client: Client,
  userId: string,
  patch: TablesUpdate<'profiles'>,
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function completeOnboarding(
  client: Client,
  userId: string,
  fullName: string,
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update({ full_name: fullName, onboarded: true })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

/**
 * Fetch a user's private billing details. Returns null when none exist yet or
 * when the caller is not allowed to read them (a peer, per RLS).
 */
export async function fetchProfileBilling(
  client: Client,
  userId: string,
): Promise<ProfileBilling | null> {
  const { data, error } = await client
    .from('profile_billing')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileBilling | null;
}

/** Upsert the caller's own billing details (self-write only, per RLS). */
export async function upsertProfileBilling(
  client: Client,
  userId: string,
  patch: Omit<TablesUpdate<'profile_billing'>, 'user_id'>,
): Promise<ProfileBilling> {
  const { data, error } = await client
    .from('profile_billing')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProfileBilling;
}
