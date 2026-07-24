import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '../schema';
import type {
  ProjectReferral,
  ProjectReferralWithProfile,
} from './project-referral.entity';

type Client = SupabaseClient<Database>;

const REFERRAL_SELECT = `
  *,
  profile:profiles(full_name, avatar_url)
` as const;

export async function fetchProjectReferrals(
  client: Client,
  projectId: string,
): Promise<ProjectReferralWithProfile[]> {
  const { data, error } = await client
    .from('project_referrals')
    .select(REFERRAL_SELECT)
    .eq('project_id', projectId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectReferralWithProfile[];
}

/**
 * Active project-referral rows for a company (project_id + user_id + percent).
 * Used to gate referral stats on company-wide P&L without a per-project fetch.
 */
export async function fetchCompanyProjectReferrals(
  client: Client,
  companyId: string,
): Promise<ProjectReferral[]> {
  const { data, error } = await client
    .from('project_referrals')
    .select('*')
    .eq('company_id', companyId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectReferral[];
}

export async function addReferral(
  client: Client,
  input: TablesInsert<'project_referrals'>,
): Promise<ProjectReferral> {
  const { data, error } = await client
    .from('project_referrals')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectReferral;
}

export async function updateReferralPercent(
  client: Client,
  id: string,
  percent: number,
): Promise<ProjectReferral> {
  const { data, error } = await client
    .from('project_referrals')
    .update({ percent })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectReferral;
}

export async function removeReferral(
  client: Client,
  id: string,
): Promise<ProjectReferral> {
  const { data, error } = await client
    .from('project_referrals')
    .update({ deleted: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectReferral;
}
