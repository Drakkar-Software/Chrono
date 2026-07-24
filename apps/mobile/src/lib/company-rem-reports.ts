import { companyFeeCents, totalCostForMonth, costCumulative } from '@chrono/sdk';
import type { Project, ProjectCost, RemPolicy, RevenueEntry } from '@chrono/sdk';

import { lastMonths } from '@/lib/reports';
import { matchesPeriodMonth, type StatsPeriod } from '@/lib/period-month';
import { todayISO } from '@/lib/date';

/** Policies that accrue company fee % into the reserve. */
const FEE_POLICIES: RemPolicy[] = ['product_pool', 'product_service'];

/** Policies that carve license % for rem partners. */
const LICENSE_POLICIES: RemPolicy[] = ['product_service'];

export type ProjectRemRef = Pick<Project, 'id' | 'rem_policy' | 'name'>;

type Rev = Pick<RevenueEntry, 'project_id' | 'period_month' | 'amount_cents' | 'paid_at'>;
type Cost = Pick<
  ProjectCost,
  'kind' | 'amount_cents' | 'active' | 'paid_at' | 'auto_deduct' | 'period_month' | 'starts_on' | 'ends_on'
>;

function policyMap(projects: ProjectRemRef[]): Map<string, RemPolicy> {
  return new Map(projects.map((p) => [p.id, p.rem_policy]));
}

function scopedRevenue(
  entries: Rev[],
  period: StatsPeriod,
  policies: Set<RemPolicy>,
  byProject: Map<string, RemPolicy>,
  paidOnly: boolean,
): number {
  return entries.reduce((acc, e) => {
    const policy = byProject.get(e.project_id);
    if (!policy || !policies.has(policy)) return acc;
    if (paidOnly && e.paid_at == null) return acc;
    if (period !== 'all' && !matchesPeriodMonth(e.period_month, period)) return acc;
    return acc + (e.amount_cents ?? 0);
  }, 0);
}

/**
 * Estimated company fee for the period from fee-eligible project revenue
 * (paid), matching rem: fee = R × company_fee_pct.
 */
export function estimateCompanyFeeCents(
  entries: Rev[],
  projects: ProjectRemRef[],
  companyFeePct: number,
  period: StatsPeriod,
): number {
  const byProject = policyMap(projects);
  const R = scopedRevenue(entries, period, new Set(FEE_POLICIES), byProject, true);
  return companyFeeCents(R, companyFeePct);
}

/**
 * Estimated license carve-out for product_service projects:
 * license = (R − fee) × license_pct on paid revenue.
 */
export function estimateLicenseRevenueCents(
  entries: Rev[],
  projects: ProjectRemRef[],
  companyFeePct: number,
  licensePct: number,
  period: StatsPeriod,
): number {
  const byProject = policyMap(projects);
  const R = scopedRevenue(entries, period, new Set(LICENSE_POLICIES), byProject, true);
  if (R <= 0 || licensePct <= 0) return 0;
  const fee = companyFeeCents(R, companyFeePct);
  return Math.round(((R - fee) * licensePct) / 100);
}

/** Pool costs for the company in the selected period (All = cumulative through today). */
export function companyPoolCostsCents(costs: Cost[], period: StatsPeriod, today = todayISO()): number {
  if (period === 'all') return costCumulative(costs, today);
  return totalCostForMonth(costs, period);
}

export type FeeVsCostsPoint = {
  month: string;
  feeCents: number;
  costsCents: number;
  /** fee − costs (positive = fee covers costs with surplus). */
  netCents: number;
};

/**
 * Last `count` months of company fee (prefer ledger, else estimate) vs pool costs.
 */
export function feeVsCostsTrend(input: {
  today?: string;
  count?: number;
  costs: Cost[];
  /** Ledger rows from company_fee_reserve_ledger. */
  feeReserve?: Array<{ period_month: string; amount_cents: number }>;
  revenueEntries: Rev[];
  projects: ProjectRemRef[];
  companyFeePct: number;
}): FeeVsCostsPoint[] {
  const today = input.today ?? todayISO();
  const months = lastMonths(today, input.count ?? 6);
  const reserveByMonth = new Map(
    (input.feeReserve ?? []).map((r) => [r.period_month.slice(0, 7), r.amount_cents]),
  );

  return months.map((month) => {
    const costsCents = totalCostForMonth(input.costs, month);
    const fromLedger = reserveByMonth.get(month);
    const feeCents =
      fromLedger != null
        ? fromLedger
        : estimateCompanyFeeCents(input.revenueEntries, input.projects, input.companyFeePct, month);
    return { month, feeCents, costsCents, netCents: feeCents - costsCents };
  });
}

export type LicenseByProject = {
  projectId: string;
  projectName: string;
  revenueCents: number;
  licenseCents: number;
};

/** Per product_service project license estimate for the period. */
export function licenseByProject(
  entries: Rev[],
  projects: ProjectRemRef[],
  companyFeePct: number,
  licensePct: number,
  period: StatsPeriod,
): LicenseByProject[] {
  const out: LicenseByProject[] = [];
  for (const p of projects) {
    if (p.rem_policy !== 'product_service') continue;
    const rev = entries.reduce((acc, e) => {
      if (e.project_id !== p.id || e.paid_at == null) return acc;
      if (period !== 'all' && !matchesPeriodMonth(e.period_month, period)) return acc;
      return acc + (e.amount_cents ?? 0);
    }, 0);
    if (rev <= 0 && licensePct <= 0) continue;
    const fee = companyFeeCents(rev, companyFeePct);
    const licenseCents = licensePct > 0 ? Math.round(((rev - fee) * licensePct) / 100) : 0;
    if (rev === 0 && licenseCents === 0) continue;
    out.push({ projectId: p.id, projectName: p.name, revenueCents: rev, licenseCents });
  }
  return out.sort((a, b) => b.licenseCents - a.licenseCents);
}

export type LicenseMonthPoint = { month: string; licenseCents: number; revenueCents: number };

export function licenseMonthlyTrend(input: {
  today?: string;
  count?: number;
  revenueEntries: Rev[];
  projects: ProjectRemRef[];
  companyFeePct: number;
  licensePct: number;
}): LicenseMonthPoint[] {
  const today = input.today ?? todayISO();
  return lastMonths(today, input.count ?? 6).map((month) => {
    const byProject = policyMap(input.projects);
    const revenueCents = scopedRevenue(
      input.revenueEntries,
      month,
      new Set(LICENSE_POLICIES),
      byProject,
      true,
    );
    const fee = companyFeeCents(revenueCents, input.companyFeePct);
    const licenseCents =
      revenueCents > 0 && input.licensePct > 0
        ? Math.round(((revenueCents - fee) * input.licensePct) / 100)
        : 0;
    return { month, licenseCents, revenueCents };
  });
}

/** Prefer rem_lines license totals when present; else estimated carve-out. */
export function resolveLicenseTotal(opts: {
  remLicenseCents: number | null;
  estimatedCents: number;
}): number {
  return opts.remLicenseCents != null ? opts.remLicenseCents : opts.estimatedCents;
}

/** Prefer fee reserve sum when present; else estimated fee. */
export function resolveCompanyFeeTotal(opts: {
  reserveCents: number | null;
  estimatedCents: number;
}): number {
  return opts.reserveCents != null ? opts.reserveCents : opts.estimatedCents;
}
