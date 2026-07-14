import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '../schema';
import type {
  ProjectMember,
  ProjectMemberWithProfile,
} from './project-member.entity';

type Client = SupabaseClient<Database>;

const PROJECT_MEMBER_SELECT = `
  *,
  profile:profiles(full_name, avatar_url)
` as const;

export async function fetchProjectMembers(
  client: Client,
  projectId: string,
): Promise<ProjectMemberWithProfile[]> {
  const { data, error } = await client
    .from('project_members')
    .select(PROJECT_MEMBER_SELECT)
    .eq('project_id', projectId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectMemberWithProfile[];
}

export async function addProjectMember(
  client: Client,
  input: TablesInsert<'project_members'>,
): Promise<ProjectMember> {
  const { data, error } = await client
    .from('project_members')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectMember;
}

export async function updateProjectMemberTjm(
  client: Client,
  id: string,
  tjmCents: number | null,
): Promise<ProjectMember> {
  const { data, error } = await client
    .from('project_members')
    .update({ tjm_cents: tjmCents })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectMember;
}

export async function removeProjectMember(
  client: Client,
  id: string,
): Promise<ProjectMember> {
  const { data, error } = await client
    .from('project_members')
    .update({ deleted: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectMember;
}
