import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores, useAppAuth } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchProfile, fetchProfileBilling } from '@chrono/sdk';
import type { Profile, ProfileBilling, TablesUpdate } from '@chrono/sdk';

/** The signed-in user's profile, or another user's when `userId` is passed. */
export function useProfile(userId?: string) {
  const { user } = useAppAuth();
  const id = userId ?? user?.id;
  return linkedQuery<Profile | null>(
    () => fetchProfile(globalSupabaseClient, id!),
    {
      stores: [stores.profiles],
      enabled: !!id,
      deps: [id],
      staleTime: 60_000,
      queryKey: `profile:${id}`,
    },
  );
}

/**
 * A user's private billing details (address, VAT, business id). RLS returns
 * these only to the user themselves and to their managers; a peer read resolves
 * to null. Defaults to the signed-in user when `userId` is omitted.
 */
export function useProfileBilling(userId?: string) {
  const { user } = useAppAuth();
  const id = userId ?? user?.id;
  return linkedQuery<ProfileBilling | null>(
    () => fetchProfileBilling(globalSupabaseClient, id!),
    {
      stores: [stores.profile_billing],
      enabled: !!id,
      deps: [id],
      staleTime: 60_000,
      queryKey: `profile-billing:${id}`,
    },
  );
}

export function useProfileBillingMutations() {
  const { upsert, isLoading, error } = useMutation(stores.profile_billing);

  const saveBilling = useCallback(
    (userId: string, patch: Omit<TablesUpdate<'profile_billing'>, 'user_id'>) =>
      upsert({ user_id: userId, ...patch }),
    [upsert],
  );

  return { saveBilling, isPending: isLoading, error };
}

export function useProfileMutations() {
  const { update, isLoading, error } = useMutation(stores.profiles);

  const updateProfile = useCallback(
    (userId: string, patch: TablesUpdate<'profiles'>) => update(userId, patch),
    [update],
  );

  // Go through the profiles store (not a bare SDK update) so linked queries —
  // especially the app layout's onboarded gate — see the new value immediately.
  // A cache miss here used to bounce successful joins straight back to onboarding.
  const completeOnboarding = useCallback(
    (userId: string, fullName: string) =>
      update(userId, { full_name: fullName, onboarded: true }),
    [update],
  );

  return {
    updateProfile,
    completeOnboarding,
    isPending: isLoading,
    error,
  };
}
