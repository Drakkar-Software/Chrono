import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchCompanyMembers, fetchMyRole } from '@chrono/sdk';
import type { AppRole, CompanyMemberWithProfile, TablesInsert } from '@chrono/sdk';

export function useCompanyMembers(companyId: string | undefined) {
  return useLinkedQuery(
    () => fetchCompanyMembers(globalSupabaseClient, companyId!),
    {
      stores: [stores.company_members],
      enabled: !!companyId,
      deps: [companyId],
      mergeToStore: stores.company_members,
      staleTime: 60_000,
      queryKey: `company-members:${companyId}`,
    },
  ) as { data: CompanyMemberWithProfile[] | undefined; isLoading: boolean; error: unknown };
}

/** The caller's role in a company. */
export function useMyRole(companyId: string | undefined, userId: string | undefined) {
  return useLinkedQuery(
    () => fetchMyRole(globalSupabaseClient, companyId!, userId!),
    {
      stores: [stores.company_members],
      enabled: !!companyId && !!userId,
      deps: [companyId, userId],
      staleTime: 60_000,
      queryKey: `my-role:${companyId}:${userId}`,
    },
  ) as { data: AppRole | null | undefined; isLoading: boolean; error: unknown };
}

// NOTE: joining a company is done ONLY by redeeming an invite token via
// `useInviteMutations().accept` (the accept_company_invite RPC). There is no
// self-join-by-company-id path — that would let anyone join any company.

export function useCompanyMemberMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.company_members);

  const add = useCallback(
    (input: TablesInsert<'company_members'>) => insert(input),
    [insert],
  );
  const updateRole = useCallback(
    (id: string, role: AppRole) => update(id, { role }),
    [update],
  );
  const updateRate = useCallback(
    (id: string, defaultHourlyRateCents: number | null) =>
      update(id, { default_hourly_rate_cents: defaultHourlyRateCents }),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { add, updateRole, updateRate, remove, isPending: isLoading, error };
}
