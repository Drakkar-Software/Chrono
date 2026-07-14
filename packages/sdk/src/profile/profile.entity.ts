import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type Profile = Tables<'profiles'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

/** Private legal identity (billing address, tax ids) — self + managers only. */
export type ProfileBilling = Tables<'profile_billing'>;
export type ProfileBillingInsert = TablesInsert<'profile_billing'>;
export type ProfileBillingUpdate = TablesUpdate<'profile_billing'>;
