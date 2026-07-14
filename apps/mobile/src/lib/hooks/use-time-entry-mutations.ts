import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchTimeEntries } from '@chrono/sdk';
import type { TablesInsert, TablesUpdate, TimeEntryWithProject } from '@chrono/sdk';

/** A single time entry by id (read from the loaded company set). */
export function useTimeEntry(id: string | undefined, companyId: string | undefined) {
  const res = useLinkedQuery(
    () => fetchTimeEntries(globalSupabaseClient, { companyId: companyId! }),
    {
      stores: [stores.time_entries],
      enabled: !!id && !!companyId,
      deps: [companyId],
      mergeToStore: stores.time_entries,
      staleTime: 30_000,
      queryKey: `time-entries:${companyId}`,
    },
  ) as { data: TimeEntryWithProject[] | undefined; isLoading: boolean; error: unknown };
  return {
    data: res.data?.find((e) => e.id === id),
    isLoading: res.isLoading,
    error: res.error,
  };
}

export function useTimeEntryMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.time_entries);

  const create = useCallback(
    (input: TablesInsert<'time_entries'>) => insert(input),
    [insert],
  );
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'time_entries'>) => update(id, updates),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { create, update: patch, remove, isPending: isLoading, error };
}

/** Convenience alias matching the task's `useCreateTimeEntry` naming. */
export function useCreateTimeEntry() {
  const { create, isPending, error } = useTimeEntryMutations();
  return { mutateAsync: create, mutate: (i: TablesInsert<'time_entries'>) => void create(i), isPending, error };
}
