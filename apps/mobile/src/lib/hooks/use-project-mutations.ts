import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import type { TablesInsert, TablesUpdate } from '@chrono/sdk';

export function useProjectMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.projects);

  const create = useCallback(
    (input: TablesInsert<'projects'>) => insert(input),
    [insert],
  );
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'projects'>) => update(id, updates),
    [update],
  );
  const archive = useCallback(
    (id: string) => update(id, { deleted: true, status: 'archived' }),
    [update],
  );

  return { create, update: patch, archive, isPending: isLoading, error };
}
