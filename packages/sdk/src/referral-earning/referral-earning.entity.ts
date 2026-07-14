import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type ReferralEarning = Tables<'referral_earnings'>;
export type ReferralEarningInsert = TablesInsert<'referral_earnings'>;
export type ReferralEarningUpdate = TablesUpdate<'referral_earnings'>;

export type ReferralEarningFilters = {
  referrerId?: string;
  projectId?: string;
  companyId?: string;
  month?: string;
};
