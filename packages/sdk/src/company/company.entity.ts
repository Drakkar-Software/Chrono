import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type Company = Tables<'companies'>;
export type CompanyInsert = TablesInsert<'companies'>;
export type CompanyUpdate = TablesUpdate<'companies'>;

/** A company joined with the calling user's role in it. */
export type CompanyMembership = Company & {
  role: Tables<'company_members'>['role'];
  member_id: Tables<'company_members'>['id'];
};
