import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type { Company, CompanyMembership } from './company.entity';

type Client = SupabaseClient<Database>;

/** Companies the user belongs to, tagged with their role. */
export async function fetchMyCompanies(
  client: Client,
  userId: string,
): Promise<CompanyMembership[]> {
  const { data, error } = await client
    .from('company_members')
    .select('id, role, company:companies(*)')
    .eq('user_id', userId)
    .eq('deleted', false);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    role: CompanyMembership['role'];
    company: Company | null;
  }>;

  return rows
    .filter((row) => row.company != null)
    .map((row) => ({
      ...(row.company as Company),
      role: row.role,
      member_id: row.id,
    }));
}

export async function fetchCompany(
  client: Client,
  id: string,
): Promise<Company> {
  const { data, error } = await client
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Company;
}

export async function createCompany(
  client: Client,
  input: TablesInsert<'companies'>,
): Promise<Company> {
  const { data, error } = await client
    .from('companies')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as Company;
}

export async function updateCompany(
  client: Client,
  id: string,
  patch: TablesUpdate<'companies'>,
): Promise<Company> {
  const { data, error } = await client
    .from('companies')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Company;
}
