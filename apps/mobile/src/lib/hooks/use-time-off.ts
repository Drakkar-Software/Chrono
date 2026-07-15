import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchUserTimeOff } from '@chrono/sdk';
import type { TimeOff, TablesInsert } from '@chrono/sdk';

/** One user's time off within an optional date range (defaults to all-time). */
export function useUserTimeOff(
  userId: string | undefined,
  companyId: string | undefined,
  from?: string,
  to?: string,
) {
  return linkedQuery<TimeOff[]>(
    () => fetchUserTimeOff(globalSupabaseClient, { companyId: companyId!, userId: userId!, from, to }),
    {
      stores: [stores.time_off],
      enabled: !!userId && !!companyId,
      deps: [userId, companyId, from, to],
      staleTime: 30_000,
      queryKey: `time-off:${userId}:${companyId}:${from}:${to}`,
    },
  );
}

export function useTimeOffMutations() {
  const { insert, remove, isLoading, error } = useMutation(stores.time_off);

  const add = useCallback((input: TablesInsert<'time_off'>) => insert(input), [insert]);
  const removeTimeOff = useCallback((id: string) => remove(id), [remove]);

  return { add, remove: removeTimeOff, isPending: isLoading, error };
}
