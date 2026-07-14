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

/**
 * Self-join a company as a freelancer via its id ("join code"). Inserts through
 * the anchor store so the membership persists + syncs. The insert is gated by
 * the `"users self-join as freelancer"` RLS policy and throws on an invalid code.
 */
export function useJoinCompany() {
  const { insert, isLoading, error } = useMutation(stores.company_members);

  const mutateAsync = useCallback(
    (params: { companyId: string; userId: string }) =>
      insert({
        company_id: params.companyId,
        user_id: params.userId,
        role: 'freelancer',
      } satisfies TablesInsert<'company_members'>),
    [insert],
  );

  return { mutateAsync, isPending: isLoading, error };
}

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
