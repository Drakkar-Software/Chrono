import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchCompany, fetchMyCompanies } from '@chrono/sdk';
import type { Company, CompanyMembership, TablesInsert, TablesUpdate } from '@chrono/sdk';

/** Companies the user belongs to, tagged with their role. */
export function useMyCompanies(userId: string | undefined) {
  return linkedQuery<CompanyMembership[]>(
    () => fetchMyCompanies(globalSupabaseClient, userId!),
    {
      stores: [stores.companies, stores.company_members],
      enabled: !!userId,
      deps: [userId],
      staleTime: 60_000,
      queryKey: `my-companies:${userId}`,
    },
  );
}

export function useCompany(id: string | undefined) {
  return linkedQuery<Company>(
    () => fetchCompany(globalSupabaseClient, id!),
    {
      stores: [stores.companies],
      enabled: !!id,
      deps: [id],
      staleTime: 60_000,
      queryKey: `company:${id}`,
    },
  );
}

export function useCompanyMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.companies);

  const create = useCallback(
    (input: TablesInsert<'companies'>) => insert(input),
    [insert],
  );
  const patch = useCallback(
    (id: string, updates: TablesUpdate<'companies'>) => update(id, updates),
    [update],
  );

  return { create, update: patch, isPending: isLoading, error };
}
