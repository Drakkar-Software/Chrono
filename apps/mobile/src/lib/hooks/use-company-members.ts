import { useCallback } from 'react';
import { useMutation } from '@drakkar.software/anchor/hooks';
import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchCompanyMembers, fetchMyRole } from '@chrono/sdk';
import type { AppRole, CompanyMemberWithProfile, TablesInsert } from '@chrono/sdk';

export function useCompanyMembers(companyId: string | undefined) {
  return linkedQuery<CompanyMemberWithProfile[]>(
    () => fetchCompanyMembers(globalSupabaseClient, companyId!),
    {
      stores: [stores.company_members],
      enabled: !!companyId,
      deps: [companyId],
      staleTime: 60_000,
      queryKey: `company-members:${companyId}`,
    },
  );
}

/** The caller's role in a company. */
export function useMyRole(companyId: string | undefined, userId: string | undefined) {
  return linkedQuery<AppRole | null>(
    () => fetchMyRole(globalSupabaseClient, companyId!, userId!),
    {
      stores: [stores.company_members],
      enabled: !!companyId && !!userId,
      deps: [companyId, userId],
      staleTime: 60_000,
      queryKey: `my-role:${companyId}:${userId}`,
    },
  );
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
  const updateCapacity = useCallback(
    (id: string, weeklyCapacityDays: number) => update(id, { weekly_capacity_days: weeklyCapacityDays }),
    [update],
  );
  /** Set (or clear, with null) this member's personal working-weekdays override. */
  const updateWorkingWeekdays = useCallback(
    (id: string, workingWeekdays: number[] | null) => update(id, { working_weekdays: workingWeekdays }),
    [update],
  );
  const updateRemPartner = useCallback(
    (id: string, remPartner: boolean) => update(id, { rem_partner: remPartner }),
    [update],
  );
  const updateRemMaxPercent = useCallback(
    (id: string, remMaxPercent: number | null) => update(id, { rem_max_percent: remMaxPercent }),
    [update],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return {
    add,
    updateRole,
    updateRate,
    updateCapacity,
    updateWorkingWeekdays,
    updateRemPartner,
    updateRemMaxPercent,
    remove,
    isPending: isLoading,
    error,
  };
}
