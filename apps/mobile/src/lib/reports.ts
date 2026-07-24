import {
  DEFAULT_HOURS_PER_DAY,
  availableFunding,
  capacityDaysInRange,
  costCumulative,
  isActiveInvoice,
  minutesToDays,
  monthBounds,
  netAvailableFunding,
  totalCostForMonth,
  totalOutstanding,
  utilization,
  utilizationStatus,
  valueUninvoicedTime,
} from '@chrono/sdk';
import type {
  CompanyMemberWithProfile,
  Invoice,
  InvoiceStatus,
  ProjectCost,
  ProjectMember,
  ReferralEarning,
  RevenueEntry,
  TimeEntryWithProject,
  UtilizationStatus,
} from '@chrono/sdk';

/** Date-range presets for scoping report figures. */
export type RangePreset = 'this_month' | 'last_month' | 'this_quarter' | 'all';

export const RANGE_OPTIONS: { label: string; value: RangePreset }[] = [
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'This quarter', value: 'this_quarter' },
  { label: 'All', value: 'all' },
];

export interface DateRange {
  /** Inclusive lower bound 'YYYY-MM-DD', or undefined for open-ended. */
  from?: string;
  /** Inclusive upper bound 'YYYY-MM-DD', or undefined for open-ended. */
  to?: string;
}

function isoMonth(year: number, monthIdx0: number): string {
  return `${year}-${String(monthIdx0 + 1).padStart(2, '0')}-01`;
}

/** Resolve a preset to concrete { from, to } bounds relative to `todayISO`. */
export function rangeBounds(preset: RangePreset, todayISO: string): DateRange {
  if (preset === 'all') return {};
  const today = new Date(`${todayISO.slice(0, 10)}T00:00:00.000Z`);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  if (preset === 'this_month') {
    const b = monthBounds(isoMonth(y, m));
    return { from: b.start, to: b.end };
  }
  if (preset === 'last_month') {
    const prev = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    const b = monthBounds(isoMonth(prev.y, prev.m));
    return { from: b.start, to: b.end };
  }
  // this_quarter — the three-month block containing the current month.
  const qStart = Math.floor(m / 3) * 3;
  const start = monthBounds(isoMonth(y, qStart)).start;
  const end = monthBounds(isoMonth(y, qStart + 2)).end;
  return { from: start, to: end };
}

/** True when a 'YYYY-MM-...' date string falls within an (inclusive) range. */
export function inRange(dateISO: string, range: DateRange): boolean {
  const day = dateISO.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export interface MonthlyPoint {
  /** 'YYYY-MM'. */
  month: string;
  revenueCents: number;
  costCents: number;
  fixedCostCents: number;
  /** Approved reimbursables spent in the month. */
  expenseCents: number;
  marginCents: number;
}

type TrendRevenue = { period_month: string; amount_cents: number };
type TrendReferral = { period_month: string; amount_cents: number };
type TrendInvoice = { period_month: string; earned_cents: number; status: InvoiceStatus };

/** The last `count` month keys ('YYYY-MM') ending at (and including) `todayISO`. */
export function lastMonths(todayISO: string, count: number): string[] {
  const today = new Date(`${todayISO.slice(0, 10)}T00:00:00.000Z`);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * Monthly revenue / cost / margin series over the last `count` months. Revenue
 * is recognized revenue; cost is earned on real (submitted+) invoices; fixed
 * costs (hosting, tooling, etc.) are each month's applicable amount from the
 * pool kinds in `costs`; expenses are approved reimbursables bucketed by
 * `spent_on`. margin = revenue − referrals − fixed costs − cost − expenses,
 * matching `projectMargin` so the trend card and the P&L card agree. Buckets by
 * `period_month`, so it's independent of the screen's date-range preset.
 */
export function monthlyTrend(
  revenueEntries: TrendRevenue[],
  referralEarnings: TrendReferral[],
  invoices: TrendInvoice[],
  costs: ProjectCost[],
  todayISO: string,
  count = 6,
): MonthlyPoint[] {
  const months = lastMonths(todayISO, count);
  const revenue = new Map<string, number>();
  const referral = new Map<string, number>();
  const cost = new Map<string, number>();
  const expense = new Map<string, number>();
  const bump = (m: Map<string, number>, key: string, v: number) => m.set(key, (m.get(key) ?? 0) + v);

  for (const r of revenueEntries) bump(revenue, r.period_month.slice(0, 7), r.amount_cents ?? 0);
  for (const r of referralEarnings) bump(referral, r.period_month.slice(0, 7), r.amount_cents ?? 0);
  for (const i of invoices) {
    if (isActiveInvoice(i.status)) {
      bump(cost, i.period_month.slice(0, 7), i.earned_cents ?? 0);
    }
  }
  for (const c of costs) {
    if (c.kind === 'reimbursable' && c.status === 'approved' && c.spent_on) {
      bump(expense, c.spent_on.slice(0, 7), c.amount_cents ?? 0);
    }
  }

  return months.map((month) => {
    const revenueCents = revenue.get(month) ?? 0;
    const costCents = cost.get(month) ?? 0;
    const fixedCostCents = totalCostForMonth(costs, month);
    const expenseCents = expense.get(month) ?? 0;
    const marginCents =
      revenueCents - (referral.get(month) ?? 0) - fixedCostCents - costCents - expenseCents;
    return { month, revenueCents, costCents, fixedCostCents, expenseCents, marginCents };
  });
}

export interface FreelancerSummary {
  userId: string;
  minutes: number;
  days: number;
  earnedCents: number;
  paidCents: number;
}

type BreakdownEntry = {
  user_id: string;
  duration_minutes: number;
  project: { hours_per_day: number } | null;
};

type BreakdownInvoice = {
  freelancer_id: string;
  earned_cents: number;
  amount_paid_cents: number;
  status: InvoiceStatus;
};

/**
 * Aggregate approved billable time (days/hours) and invoiced earned/paid amounts
 * per freelancer. Days use each entry's project `hours_per_day`; earned/paid come
 * from the freelancer's invoices (already reconciled money, in cents).
 */
export function summarizeFreelancers(
  entries: BreakdownEntry[],
  invoices: BreakdownInvoice[],
): FreelancerSummary[] {
  const byUser = new Map<string, FreelancerSummary>();
  const get = (userId: string): FreelancerSummary => {
    let s = byUser.get(userId);
    if (!s) {
      s = { userId, minutes: 0, days: 0, earnedCents: 0, paidCents: 0 };
      byUser.set(userId, s);
    }
    return s;
  };

  for (const e of entries) {
    const s = get(e.user_id);
    s.minutes += e.duration_minutes ?? 0;
    s.days += minutesToDays(e.duration_minutes ?? 0, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY);
  }
  for (const inv of invoices) {
    // Only real invoices count — cancelled keeps frozen earned_cents in the DB
    // and drafts aren't claims yet; either would inflate the freelancer's total.
    if (!isActiveInvoice(inv.status)) continue;
    const s = get(inv.freelancer_id);
    s.earnedCents += inv.earned_cents ?? 0;
    s.paidCents += inv.amount_paid_cents ?? 0;
  }

  return [...byUser.values()].sort(
    (a, b) => b.earnedCents - a.earnedCents || b.minutes - a.minutes,
  );
}

export interface UtilizationRow {
  userId: string;
  workedDays: number;
  capacityDays: number;
  utilizationPct: number;
  status: UtilizationStatus;
}

/**
 * Actuals-based utilization per member for `range`: worked days (from
 * `freelancerRows`, already summarized by `summarizeFreelancers`) over
 * capacity days (each member's `weekly_capacity_days` prorated over the
 * range). Empty for an open-ended range — there is no bounded denominator.
 */
export function summarizeUtilization(
  freelancerRows: FreelancerSummary[],
  members: CompanyMemberWithProfile[],
  range: DateRange,
): UtilizationRow[] {
  if (!range.from || !range.to) return [];
  const workedByUser = new Map(freelancerRows.map((r) => [r.userId, r.days]));

  return members.map((m) => {
    const workedDays = workedByUser.get(m.user_id) ?? 0;
    const capacityDays = capacityDaysInRange(m.weekly_capacity_days, range);
    const utilizationPct = utilization(workedDays, capacityDays);
    return {
      userId: m.user_id,
      workedDays,
      capacityDays,
      utilizationPct,
      status: utilizationStatus(utilizationPct),
    };
  });
}

/** Bucket rows by their `project_id` for O(1) per-project lookup. */
export function groupByProject<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const arr = map.get(row.project_id);
    if (arr) arr.push(row);
    else map.set(row.project_id, [row]);
  }
  return map;
}

/**
 * Lifetime net available funding for a project (same figure as P&L "Disponible net"):
 * paid pool − referrals − cumulative costs − invoice payments, then minus outstanding
 * invoices + valued uninvoiced approved time.
 */
export function projectNetAvailableCents(input: {
  revenueEntries: Array<Pick<RevenueEntry, 'amount_cents' | 'paid_at'>>;
  referralEarnings: Array<Pick<ReferralEarning, 'amount_cents'>>;
  invoices: Array<
    Pick<Invoice, 'project_id' | 'freelancer_id' | 'period_month' | 'status' | 'amount_due_cents' | 'amount_paid_cents'>
  >;
  costs: ProjectCost[];
  uninvoicedTimeCents?: number;
  /** Inclusive through-date for cumulative pool costs (usually today). */
  throughDateISO: string;
}): number {
  const paidInvoices = input.invoices.map((i) => ({ amount_paid_cents: i.amount_paid_cents ?? 0 }));
  const fixedCostCents = costCumulative(input.costs, input.throughDateISO);
  const funding = availableFunding(
    input.revenueEntries,
    input.referralEarnings,
    paidInvoices,
    fixedCostCents,
  );
  const owedCents = totalOutstanding(input.invoices) + (input.uninvoicedTimeCents ?? 0);
  return netAvailableFunding(funding, owedCents);
}

/**
 * Approved billable time not yet invoiced, valued per project at each
 * freelancer's effective day rate (see `valueUninvoicedTime`). Buckets
 * `entries` by `project_id` and reads each project's rate straight off its
 * join (`entry.project`), so no separate per-project fetch is needed —
 * `membersByProject` only needs to supply per-freelancer rate overrides.
 */
export function uninvoicedTimeByProject(
  entries: TimeEntryWithProject[],
  membersByProject: Map<string, ProjectMember[]>,
): Map<string, number> {
  const byProject = new Map<string, TimeEntryWithProject[]>();
  for (const e of entries) {
    const arr = byProject.get(e.project_id);
    if (arr) arr.push(e);
    else byProject.set(e.project_id, [e]);
  }

  const out = new Map<string, number>();
  for (const [projectId, projectEntries] of byProject) {
    const project = projectEntries[0].project;
    if (!project) continue;
    out.set(projectId, valueUninvoicedTime(projectEntries, project, membersByProject.get(projectId) ?? []));
  }
  return out;
}
