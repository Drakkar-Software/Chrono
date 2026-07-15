import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '../schema';
import type { CompanyHoliday } from './company-holiday.entity';

type Client = SupabaseClient<Database>;

export async function fetchCompanyHolidays(
  client: Client,
  companyId: string,
): Promise<CompanyHoliday[]> {
  const { data, error } = await client
    .from('company_holidays')
    .select('*')
    .eq('company_id', companyId)
    .order('holiday_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompanyHoliday[];
}

export async function addCompanyHoliday(
  client: Client,
  input: TablesInsert<'company_holidays'>,
): Promise<CompanyHoliday> {
  const { data, error } = await client
    .from('company_holidays')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as CompanyHoliday;
}

export async function removeCompanyHoliday(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client.from('company_holidays').delete().eq('id', id);
  if (error) throw error;
}
