import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type { ExpenseFilters, ProjectExpense } from './project-expense.entity';

type Client = SupabaseClient<Database>;

export async function fetchProjectExpenses(
  client: Client,
  filters: ExpenseFilters,
): Promise<ProjectExpense[]> {
  let query = client
    .from('project_expenses')
    .select('*')
    .eq('company_id', filters.companyId)
    .eq('deleted', false)
    .order('spent_on', { ascending: false });

  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectExpense[];
}

export async function fetchPendingExpenses(
  client: Client,
  companyId: string,
): Promise<ProjectExpense[]> {
  return fetchProjectExpenses(client, { companyId, status: 'pending' });
}

export async function createExpense(
  client: Client,
  input: TablesInsert<'project_expenses'>,
): Promise<ProjectExpense> {
  const { data, error } = await client
    .from('project_expenses')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectExpense;
}

export async function updateExpense(
  client: Client,
  id: string,
  patch: TablesUpdate<'project_expenses'>,
): Promise<ProjectExpense> {
  const { data, error } = await client
    .from('project_expenses')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectExpense;
}

export async function approveExpense(client: Client, id: string): Promise<ProjectExpense> {
  return updateExpense(client, id, { status: 'approved' });
}

export async function rejectExpense(
  client: Client,
  id: string,
  reason: string,
): Promise<ProjectExpense> {
  return updateExpense(client, id, { status: 'rejected', rejection_reason: reason });
}

export async function markExpenseReimbursed(
  client: Client,
  id: string,
  reimbursedBy: string,
): Promise<ProjectExpense> {
  return updateExpense(client, id, { reimbursed_at: new Date().toISOString(), reimbursed_by: reimbursedBy });
}

export async function removeExpense(client: Client, id: string): Promise<ProjectExpense> {
  return updateExpense(client, id, { deleted: true });
}
