import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type CompanyMember = Tables<'company_members'>;
export type CompanyMemberInsert = TablesInsert<'company_members'>;
export type CompanyMemberUpdate = TablesUpdate<'company_members'>;

export type CompanyMemberWithProfile = CompanyMember & {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};
