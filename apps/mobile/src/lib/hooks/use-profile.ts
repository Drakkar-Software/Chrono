import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores, useAppAuth } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { completeOnboarding as sdkCompleteOnboarding, fetchProfile } from '@chrono/sdk';
import type { Profile, TablesUpdate } from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

/** The signed-in user's profile, or another user's when `userId` is passed. */
export function useProfile(userId?: string) {
  const { user } = useAppAuth();
  const id = userId ?? user?.id;
  return useLinkedQuery(
    () => fetchProfile(globalSupabaseClient, id!),
    {
      stores: [stores.profiles],
      enabled: !!id,
      deps: [id],
      staleTime: 60_000,
      queryKey: `profile:${id}`,
    },
  ) as { data: Profile | null | undefined; isLoading: boolean; error: unknown };
}

export function useProfileMutations() {
  const { update, isLoading, error } = useMutation(stores.profiles);

  const updateProfile = useCallback(
    (userId: string, patch: TablesUpdate<'profiles'>) => update(userId, patch),
    [update],
  );

  const complete = useAsyncAction((userId: string, fullName: string) =>
    sdkCompleteOnboarding(globalSupabaseClient, userId, fullName),
  );

  return {
    updateProfile,
    completeOnboarding: complete.mutateAsync,
    isPending: isLoading || complete.isPending,
    error: error ?? complete.error,
  };
}
