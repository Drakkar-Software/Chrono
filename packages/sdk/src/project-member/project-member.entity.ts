import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type ProjectMember = Tables<'project_members'>;
export type ProjectMemberInsert = TablesInsert<'project_members'>;
export type ProjectMemberUpdate = TablesUpdate<'project_members'>;

export type ProjectMemberWithProfile = ProjectMember & {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};
