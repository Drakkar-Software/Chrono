import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database, TablesInsert } from '../schema';
import type {
  CompanyMember,
  CompanyMemberWithProfile,
} from './company-member.entity';

type Client = SupabaseClient<Database>;

const MEMBER_SELECT = `
  *,
  profile:profiles(full_name, avatar_url)
` as const;

export async function fetchCompanyMembers(
  client: Client,
  companyId: string,
): Promise<CompanyMemberWithProfile[]> {
  const { data, error } = await client
    .from('company_members')
    .select(MEMBER_SELECT)
    .eq('company_id', companyId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CompanyMemberWithProfile[];
}

/** The caller's role in a company, or null if they are not a member. */
export async function fetchMyRole(
  client: Client,
  companyId: string,
  userId: string,
): Promise<AppRole | null> {
  const { data, error } = await client
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('deleted', false)
    .maybeSingle();
  if (error) throw error;
  return (data?.role ?? null) as AppRole | null;
}

export async function addCompanyMember(
  client: Client,
  input: TablesInsert<'company_members'>,
): Promise<CompanyMember> {
  const { data, error } = await client
    .from('company_members')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyMember;
}

/**
 * Self-join a company as a freelancer using its id (shared as a "join code" by a
 * manager). Backed by the `"users self-join as freelancer"` RLS policy, which
 * permits a user to INSERT only their OWN row with `role='freelancer'`. Throws
 * if the company id is invalid or the policy rejects the insert.
 */
export async function joinCompany(
  client: Client,
  params: { companyId: string; userId: string },
): Promise<CompanyMember> {
  const input: TablesInsert<'company_members'> = {
    company_id: params.companyId,
    user_id: params.userId,
    role: 'freelancer',
  };
  const { data, error } = await client
    .from('company_members')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyMember;
}

export async function updateMemberRole(
  client: Client,
  id: string,
  role: AppRole,
): Promise<CompanyMember> {
  const { data, error } = await client
    .from('company_members')
    .update({ role })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyMember;
}

export async function updateMemberRate(
  client: Client,
  id: string,
  defaultHourlyRateCents: number | null,
): Promise<CompanyMember> {
  const { data, error } = await client
    .from('company_members')
    .update({ default_hourly_rate_cents: defaultHourlyRateCents })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyMember;
}

export async function removeMember(
  client: Client,
  id: string,
): Promise<CompanyMember> {
  const { data, error } = await client
    .from('company_members')
    .update({ deleted: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyMember;
}
