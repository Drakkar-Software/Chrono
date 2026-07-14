import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import {
  acceptCompanyInvite,
  createCompanyInvite,
  fetchCompanyInvites,
} from '@chrono/sdk';
import type { AppRole, CompanyInvite } from '@chrono/sdk';

/** A company's invites (managers only), offline-first. */
export function useCompanyInvites(companyId: string | undefined) {
  return useLinkedQuery(() => fetchCompanyInvites(globalSupabaseClient, companyId!), {
    stores: [stores.company_invites],
    enabled: !!companyId,
    deps: [companyId],
    mergeToStore: stores.company_invites,
    staleTime: 30_000,
    queryKey: `company-invites:${companyId}`,
  }) as {
    data: CompanyInvite[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => Promise<void>;
  };
}

export function useInviteMutations() {
  const { update, isLoading, error } = useMutation(stores.company_invites);

  const create = useCallback(
    (input: { companyId: string; email: string; role: AppRole; invitedBy: string }) =>
      createCompanyInvite(globalSupabaseClient, input),
    [],
  );
  const revoke = useCallback(
    (id: string) => update(id, { revoked_at: new Date().toISOString() }),
    [update],
  );
  const accept = useCallback(
    (token: string) => acceptCompanyInvite(globalSupabaseClient, token),
    [],
  );

  return { create, revoke, accept, isPending: isLoading, error };
}
