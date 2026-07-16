import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '../schema';
import type { CostFilters, ProjectCost } from './project-cost.entity';

type Client = SupabaseClient<Database>;

export async function fetchProjectCosts(client: Client, filters: CostFilters): Promise<ProjectCost[]> {
  let query = client
    .from('project_costs')
    .select('*')
    .eq('company_id', filters.companyId)
    .eq('deleted', false)
    .order('created_at', { ascending: true });

  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectCost[];
}

/** Pending reimbursables awaiting manager review. */
export async function fetchPendingExpenses(client: Client, companyId: string): Promise<ProjectCost[]> {
  return fetchProjectCosts(client, { companyId, kind: 'reimbursable', status: 'pending' });
}

export async function createProjectCost(
  client: Client,
  input: TablesInsert<'project_costs'>,
): Promise<ProjectCost> {
  const { data, error } = await client.from('project_costs').insert(input).select('*').single();
  if (error) throw error;
  return data as ProjectCost;
}

export async function updateProjectCost(
  client: Client,
  id: string,
  patch: TablesUpdate<'project_costs'>,
): Promise<ProjectCost> {
  const { data, error } = await client
    .from('project_costs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectCost;
}

export async function approveCost(client: Client, id: string): Promise<ProjectCost> {
  return updateProjectCost(client, id, { status: 'approved' });
}

export async function rejectCost(client: Client, id: string, reason: string): Promise<ProjectCost> {
  return updateProjectCost(client, id, { status: 'rejected', rejection_reason: reason });
}

export async function markCostReimbursed(
  client: Client,
  id: string,
  reimbursedBy: string,
): Promise<ProjectCost> {
  return updateProjectCost(client, id, {
    reimbursed_at: new Date().toISOString(),
    reimbursed_by: reimbursedBy,
  });
}

export async function removeProjectCost(client: Client, id: string): Promise<ProjectCost> {
  return updateProjectCost(client, id, { deleted: true });
}

/**
 * Mark pool costs paid / unpaid. Goes through the RPC (not a direct update) so
 * the manager check and the reimbursable guard live in one place server-side —
 * mirrors `markRevenueEntriesPaid`.
 */
export async function markProjectCostsPaid(
  client: Client,
  costIds: string[],
  paid = true,
): Promise<void> {
  const { error } = await client.rpc('mark_project_costs_paid', {
    p_cost_ids: costIds,
    p_paid: paid,
  });
  if (error) throw error;
}
