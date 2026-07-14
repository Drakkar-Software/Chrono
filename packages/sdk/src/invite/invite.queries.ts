import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { AppRole } from '../schema';
import type { CompanyInvite } from './invite.entity';

type Client = SupabaseClient<Database>;

/** A company's invites (managers only, per RLS), newest first. */
export async function fetchCompanyInvites(
  client: Client,
  companyId: string,
): Promise<CompanyInvite[]> {
  const { data, error } = await client
    .from('company_invites')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompanyInvite[];
}

/** Create an invite. The token is generated server-side by the column default. */
export async function createCompanyInvite(
  client: Client,
  input: { companyId: string; email: string; role: AppRole; invitedBy: string },
): Promise<CompanyInvite> {
  const { data, error } = await client
    .from('company_invites')
    .insert({
      company_id: input.companyId,
      email: input.email,
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyInvite;
}

/** Revoke an invite so its token can no longer be redeemed. */
export async function revokeCompanyInvite(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('company_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Redeem an invite token (join the company at the invited role). Returns the
 * company id. Runs the `accept_company_invite` SECURITY DEFINER RPC so the
 * invitee never needs table-level read access to the invite.
 */
export async function acceptCompanyInvite(
  client: Client,
  token: string,
): Promise<string> {
  const { data, error } = await client.rpc('accept_company_invite', {
    p_token: token.trim(),
  });
  if (error) throw error;
  return data as string;
}
