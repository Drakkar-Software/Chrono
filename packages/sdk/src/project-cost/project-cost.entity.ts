import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type ProjectCost = Tables<'project_costs'>;
export type ProjectCostInsert = TablesInsert<'project_costs'>;
export type ProjectCostUpdate = TablesUpdate<'project_costs'>;

export type CostFilters = {
  companyId: string;
  userId?: string;
  projectId?: string;
  kind?: ProjectCost['kind'];
  status?: ProjectCost['status'];
};

/**
 * The kinds that feed the funding pool. A 'reimbursable' is deliberately
 * excluded — it reduces margin but is paid outside settle_project_month.
 * Mirrors the `kind in ('recurring','one_off')` filter in
 * `project_cost_cumulative`.
 */
export const POOL_COST_KINDS = ['recurring', 'one_off'] as const;

export function isPoolCost(cost: Pick<ProjectCost, 'kind'>): boolean {
  return cost.kind === 'recurring' || cost.kind === 'one_off';
}

export function isReimbursable(cost: Pick<ProjectCost, 'kind'>): boolean {
  return cost.kind === 'reimbursable';
}
