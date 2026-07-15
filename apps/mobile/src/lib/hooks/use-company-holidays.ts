import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchCompanyHolidays } from '@chrono/sdk';
import type { CompanyHoliday, TablesInsert } from '@chrono/sdk';

export function useCompanyHolidays(companyId: string | undefined) {
  return linkedQuery<CompanyHoliday[]>(
    () => fetchCompanyHolidays(globalSupabaseClient, companyId!),
    {
      stores: [stores.company_holidays],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-holidays:${companyId}`,
    },
  );
}

export function useCompanyHolidayMutations() {
  const { insert, remove, isLoading, error } = useMutation(stores.company_holidays);

  const add = useCallback(
    (input: TablesInsert<'company_holidays'>) => insert(input),
    [insert],
  );
  const removeHoliday = useCallback((id: string) => remove(id), [remove]);

  return { add, remove: removeHoliday, isPending: isLoading, error };
}
