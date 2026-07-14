import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesUpdate } from '../schema';
import type { Profile } from './profile.entity';

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
