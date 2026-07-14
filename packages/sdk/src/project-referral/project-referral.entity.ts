import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type ProjectReferral = Tables<'project_referrals'>;
export type ProjectReferralInsert = TablesInsert<'project_referrals'>;
export type ProjectReferralUpdate = TablesUpdate<'project_referrals'>;

export type ProjectReferralWithProfile = ProjectReferral & {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};
