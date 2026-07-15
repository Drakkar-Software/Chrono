import type { ProjectFixedCost } from './project-fixed-cost.entity';

type Cost = Pick<
  ProjectFixedCost,
  'cadence' | 'amount_cents' | 'active' | 'period_month' | 'starts_on' | 'ends_on'
>;

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

/** This cost's contribution (cents) in exactly one month. Matches recognize-style scoping. */
export function fixedCostForMonth(cost: Cost, monthISO: string): number {
  if (!cost.active) return 0;
  if (cost.cadence === 'one_off') {
    return cost.period_month && monthOf(cost.period_month) === monthOf(monthISO) ? cost.amount_cents : 0;
  }
  return inRecurringWindow(cost, monthISO) ? cost.amount_cents : 0;
}

/** Total fixed cost across `costs` for exactly one month. */
export function totalFixedCostForMonth(costs: Cost[], monthISO: string): number {
  return costs.reduce((acc, c) => acc + fixedCostForMonth(c, monthISO), 0);
}

/** Inclusive month count between two 'YYYY-MM' keys. */
function monthsBetweenInclusive(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/**
 * Cumulative fixed-cost cents through (and including) the month containing
 * `throughMonthISO`. Mirrors `project_fixed_cost_cumulative` in the DB: a
 * one_off cost counts once its month has arrived; a recurring cost counts
 * once per elapsed month in its window. Matches settle_project_month's
 * pool math (`v_cum_fixed`) so the app's displayed balance agrees with settle.
 */
export function fixedCostCumulative(costs: Cost[], throughMonthISO: string): number {
  const through = monthOf(throughMonthISO);
  return costs.reduce((acc, c) => {
    if (!c.active) return acc;
    if (c.cadence === 'one_off') {
      return c.period_month && monthOf(c.period_month) <= through ? acc + c.amount_cents : acc;
    }
    if (!c.starts_on || monthOf(c.starts_on) > through) return acc;
    const end = c.ends_on && monthOf(c.ends_on) < through ? monthOf(c.ends_on) : through;
    return acc + c.amount_cents * monthsBetweenInclusive(monthOf(c.starts_on), end);
  }, 0);
}
