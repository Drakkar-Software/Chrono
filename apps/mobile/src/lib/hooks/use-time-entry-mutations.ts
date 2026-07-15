import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchTimeEntry } from '@chrono/sdk';
import type { TablesInsert, TablesUpdate, TimeEntryWithProject } from '@chrono/sdk';

/** A single time entry by id — one row, not a company-wide scan. */
export function useTimeEntry(id: string | undefined, companyId: string | undefined) {
  void companyId; // kept for call-site symmetry; the id alone identifies the row
  return linkedQuery<TimeEntryWithProject | null>(
    () => fetchTimeEntry(globalSupabaseClient, id!),
    {
      stores: [stores.time_entries],
      enabled: !!id,
      deps: [id],
      staleTime: 30_000,
      queryKey: `time-entry:${id}`,
    },
  );
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
