import type { ProjectCost } from './project-cost.entity';

type Cost = Pick<
  ProjectCost,
  | 'kind'
  | 'amount_cents'
  | 'active'
  | 'paid_at'
  | 'auto_deduct'
  | 'period_month'
  | 'starts_on'
  | 'ends_on'
>;

type Reimbursable = Pick<ProjectCost, 'kind' | 'user_id' | 'amount_cents' | 'status' | 'reimbursed_at'>;

/** 'YYYY-MM-DD' or 'YYYY-MM' -> 'YYYY-MM'. */
function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** True when `monthISO` falls within a recurring cost's [starts_on, ends_on] window. */
function inRecurringWindow(cost: Pick<Cost, 'starts_on' | 'ends_on'>, monthISO: string): boolean {
  if (!cost.starts_on) return false;
  const month = monthOf(monthISO);
  if (month < monthOf(cost.starts_on)) return false;
  if (cost.ends_on && month > monthOf(cost.ends_on)) return false;
  return true;
}

/**
 * Whether this cost is deducted from the pool at all: it must be a pool kind
 * AND paid. An auto-deducting recurring cost counts as paid every elapsed
 * month. Mirrors the `paid_at is not null or (kind = 'recurring' and
 * auto_deduct)` gate in `project_cost_cumulative` — change both together.
 */
function isDeductible(cost: Cost): boolean {
  if (!cost.active) return false;
  if (cost.kind === 'reimbursable') return false;
  return cost.paid_at != null || (cost.kind === 'recurring' && cost.auto_deduct);
}

/** This cost's contribution (cents) in exactly one month. */
export function costForMonth(cost: Cost, monthISO: string): number {
  if (!isDeductible(cost)) return 0;
  if (cost.kind === 'one_off') {
    return cost.period_month && monthOf(cost.period_month) === monthOf(monthISO) ? cost.amount_cents : 0;
  }
  return inRecurringWindow(cost, monthISO) ? cost.amount_cents : 0;
}

/** Total pool cost across `costs` for exactly one month. */
export function totalCostForMonth(costs: Cost[], monthISO: string): number {
  return costs.reduce((acc, c) => acc + costForMonth(c, monthISO), 0);
}

/** Inclusive month count between two 'YYYY-MM' keys. */
function monthsBetweenInclusive(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/**
 * Cumulative pool-cost cents through (and including) the month containing
 * `throughMonthISO`. Mirrors `project_cost_cumulative` in the DB: a one_off
 * counts once its month has arrived; a recurring counts once per elapsed month
 * in its window; both only when paid (or auto-deducting). Matches
 * settle_project_month's pool math (`v_cum_fixed`) so the app's displayed
 * balance agrees with settle.
 */
export function costCumulative(costs: Cost[], throughMonthISO: string): number {
  const through = monthOf(throughMonthISO);
  return costs.reduce((acc, c) => {
    if (!isDeductible(c)) return acc;
    if (c.kind === 'one_off') {
      return c.period_month && monthOf(c.period_month) <= through ? acc + c.amount_cents : acc;
    }
    if (!c.starts_on || monthOf(c.starts_on) > through) return acc;
    const end = c.ends_on && monthOf(c.ends_on) < through ? monthOf(c.ends_on) : through;
    return acc + c.amount_cents * monthsBetweenInclusive(monthOf(c.starts_on), end);
  }, 0);
}

/** Pool costs configured but not yet paid — money committed, not yet out the door. */
export function unpaidPoolCosts<T extends Cost>(costs: T[]): T[] {
  return costs.filter(
    (c) => c.active && c.kind !== 'reimbursable' && c.paid_at == null && !(c.kind === 'recurring' && c.auto_deduct),
  );
}

/** Total of approved reimbursables (cents) — a real cost, regardless of reimbursement state. */
export function sumApprovedExpenses(
  costs: Pick<ProjectCost, 'kind' | 'amount_cents' | 'status'>[],
): number {
  return costs
    .filter((c) => c.kind === 'reimbursable' && c.status === 'approved')
    .reduce((acc, c) => acc + (c.amount_cents ?? 0), 0);
}

/** Approved reimbursables not yet marked reimbursed. */
export function reimbursementsOwed<T extends Reimbursable>(costs: T[]): T[] {
  return costs.filter((c) => c.kind === 'reimbursable' && c.status === 'approved' && c.reimbursed_at == null);
}

/** Cents owed per freelancer (approved reimbursables, not yet reimbursed). */
export function expensesOwedByUser(costs: Reimbursable[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of reimbursementsOwed(costs)) {
    if (!c.user_id) continue;
    out[c.user_id] = (out[c.user_id] ?? 0) + (c.amount_cents ?? 0);
  }
  return out;
}
