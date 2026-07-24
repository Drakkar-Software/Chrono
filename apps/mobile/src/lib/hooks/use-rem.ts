import { useCallback } from 'react';
import { linkedQuery } from './linked-query';
import { globalSupabaseClient } from '@/lib/supabase';
import {
  computeRemMonth,
  fetchCompanyFeeReserve,
  fetchRemLines,
  fetchRemMonth,
  lockRemMonth,
  type RemLine,
  type RemMonth,
} from '@chrono/sdk';
import { monthKey } from '@chrono/sdk';

export function useRemMonth(companyId: string | undefined, month: string | undefined) {
  return linkedQuery<RemMonth | null>(
    () => fetchRemMonth(globalSupabaseClient, companyId!, month!),
    {
      stores: [],
      enabled: !!companyId && !!month,
      deps: [companyId, month],
      staleTime: 30_000,
      queryKey: `rem-month:${companyId}:${month}`,
    },
  );
}

export function useRemLines(monthId: string | undefined) {
  return linkedQuery<RemLine[]>(
    () => fetchRemLines(globalSupabaseClient, monthId!),
    {
      stores: [],
      enabled: !!monthId,
      deps: [monthId],
      staleTime: 30_000,
      queryKey: `rem-lines:${monthId}`,
    },
  );
}

export function useRemMutations() {
  const compute = useCallback(
    (companyId: string, month: string) => computeRemMonth(globalSupabaseClient, companyId, month),
    [],
  );
  const lock = useCallback(
    (companyId: string, month: string) => lockRemMonth(globalSupabaseClient, companyId, month),
    [],
  );
  return { compute, lock };
}

export function useCompanyFeeReserve(companyId: string | undefined, month?: string) {
  return linkedQuery(
    () => fetchCompanyFeeReserve(globalSupabaseClient, companyId!, month),
    {
      stores: [],
      enabled: !!companyId,
      deps: [companyId, month],
      staleTime: 60_000,
      queryKey: `fee-reserve:${companyId}:${month ?? 'all'}`,
    },
  );
}

export { monthKey };
