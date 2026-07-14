import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { acceptCompanyInvite, fetchCompanyInvites } from '@chrono/sdk';
import type { AppRole, CompanyInvite } from '@chrono/sdk';

/** A company's invites (managers only), offline-first. */
export function useCompanyInvites(companyId: string | undefined) {
  return useLinkedQuery(() => fetchCompanyInvites(globalSupabaseClient, companyId!), {
    stores: [stores.company_invites],
    enabled: !!companyId,
    deps: [companyId],
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
  const { insert, update, isLoading, error } = useMutation(stores.company_invites);

  // Insert through the store so the new invite (with its DB-generated token)
  // shows up in useCompanyInvites immediately, without waiting for a refetch.
  const create = useCallback(
    (input: { companyId: string; email: string; role: AppRole; invitedBy: string }) =>
      insert({
        company_id: input.companyId,
        email: input.email,
        role: input.role,
        invited_by: input.invitedBy,
      }),
    [insert],
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
