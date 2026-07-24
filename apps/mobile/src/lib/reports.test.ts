import { describe, expect, it } from 'vitest';
import { lastMonths, monthlyTrend, summarizeUtilization, uninvoicedTimeByProject } from './reports';
import type {
  CompanyMemberWithProfile,
  ProjectCost,
  ProjectMember,
  TimeEntryWithProject,
} from '@chrono/sdk';

describe('lastMonths', () => {
  it('returns N ascending month keys ending at today', () => {
    expect(lastMonths('2026-03-15', 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
  });

  it('wraps across year boundaries', () => {
    expect(lastMonths('2026-01-10', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

/** An auto-deducting recurring pool cost of 2000 running from Jan 2026. */
const recurringCost = () =>
  ({
    kind: 'recurring',
    amount_cents: 2000,
    active: true,
    paid_at: null,
    auto_deduct: true,
    period_month: null,
    starts_on: '2026-01-01',
    ends_on: null,
    status: null,
  }) as unknown as ProjectCost;

const approvedExpense = (spentOn: string, cents: number) =>
  ({
    kind: 'reimbursable',
    amount_cents: cents,
    active: true,
    paid_at: null,
    auto_deduct: false,
    status: 'approved',
    spent_on: spentOn,
    user_id: 'u1',
  }) as unknown as ProjectCost;

describe('monthlyTrend', () => {
  it('buckets revenue, cost and margin by period_month', () => {
    const rows = monthlyTrend(
      [
        { period_month: '2026-03-01', amount_cents: 100000 },
        { period_month: '2026-02-01', amount_cents: 50000 },
      ],
      [{ period_month: '2026-03-01', amount_cents: 10000 }],
      [
        { period_month: '2026-03-01', earned_cents: 40000, status: 'paid' },
        { period_month: '2026-03-01', earned_cents: 99999, status: 'draft' }, // excluded
      ],
      [],
      '2026-03-10',
      2,
    );
    expect(rows).toEqual([
      { month: '2026-02', revenueCents: 50000, costCents: 0, fixedCostCents: 0, expenseCents: 0, marginCents: 50000 },
      // margin = 100000 revenue - 10000 referral - 40000 cost = 50000
      { month: '2026-03', revenueCents: 100000, costCents: 40000, fixedCostCents: 0, expenseCents: 0, marginCents: 50000 },
    ]);
  });

  it('subtracts each month\'s applicable fixed cost from margin', () => {
    const rows = monthlyTrend(
      [{ period_month: '2026-03-01', amount_cents: 100000 }],
      [],
      [],
      [recurringCost()],
      '2026-03-10',
      2,
    );
    expect(rows).toEqual([
      { month: '2026-02', revenueCents: 0, costCents: 0, fixedCostCents: 2000, expenseCents: 0, marginCents: -2000 },
      { month: '2026-03', revenueCents: 100000, costCents: 0, fixedCostCents: 2000, expenseCents: 0, marginCents: 98000 },
    ]);
  });

  // Regression: the trend used to omit expenses entirely while projectMargin
  // subtracted them, so the Trends card and the P&L card disagreed for any
  // project with approved reimbursables.
  it('subtracts approved reimbursables from margin, bucketed by spent_on', () => {
    const rows = monthlyTrend(
      [{ period_month: '2026-03-01', amount_cents: 100000 }],
      [],
      [],
      [
        approvedExpense('2026-03-04', 5000),
        approvedExpense('2026-02-04', 1000),
        // Not approved -> not a cost yet.
        { ...approvedExpense('2026-03-05', 9999), status: 'pending' },
      ],
      '2026-03-10',
      2,
    );
    expect(rows).toEqual([
      { month: '2026-02', revenueCents: 0, costCents: 0, fixedCostCents: 0, expenseCents: 1000, marginCents: -1000 },
      { month: '2026-03', revenueCents: 100000, costCents: 0, fixedCostCents: 0, expenseCents: 5000, marginCents: 95000 },
    ]);
  });

  it('never counts a reimbursable as a pool (fixed) cost', () => {
    const rows = monthlyTrend([], [], [], [approvedExpense('2026-03-04', 5000)], '2026-03-10', 1);
    expect(rows[0].fixedCostCents).toBe(0);
    expect(rows[0].expenseCents).toBe(5000);
  });

  it('yields zeroed months with no activity', () => {
    const rows = monthlyTrend([], [], [], [], '2026-03-10', 2);
    expect(
      rows.every(
        (r) =>
          r.revenueCents === 0 &&
          r.costCents === 0 &&
          r.fixedCostCents === 0 &&
          r.expenseCents === 0 &&
          r.marginCents === 0,
      ),
    ).toBe(true);
  });
});

function member(userId: string, weeklyCapacityDays: number): CompanyMemberWithProfile {
  return {
    id: userId,
    company_id: 'c1',
    user_id: userId,
    role: 'freelancer',
    default_hourly_rate_cents: null,
    weekly_capacity_days: weeklyCapacityDays,
    working_weekdays: null,
    rem_partner: false,
    rem_max_percent: null,
    created_at: '',
    updated_at: '',
    deleted: false,
    profile: null,
  };
}

describe('summarizeUtilization', () => {
  it('is worked days over prorated capacity days for a bounded range', () => {
    // 7-day range (Mon-Sun): capacity = 5 days for a 5-day/week member.
    const rows = summarizeUtilization(
      [{ userId: 'a', minutes: 0, days: 4, earnedCents: 0, paidCents: 0 }],
      [member('a', 5)],
      { from: '2026-07-06', to: '2026-07-12' },
    );
    expect(rows).toEqual([
      { userId: 'a', workedDays: 4, capacityDays: 5, utilizationPct: 80, status: 'ok' },
    ]);
  });

  it('flags over-capacity and under-utilized members', () => {
    const rows = summarizeUtilization(
      [
        { userId: 'over', minutes: 0, days: 7, earnedCents: 0, paidCents: 0 },
        { userId: 'under', minutes: 0, days: 1, earnedCents: 0, paidCents: 0 },
      ],
      [member('over', 5), member('under', 5)],
      { from: '2026-07-06', to: '2026-07-12' },
    );
    expect(rows.find((r) => r.userId === 'over')?.status).toBe('over');
    expect(rows.find((r) => r.userId === 'under')?.status).toBe('under');
  });

  it('defaults a member with no logged time to 0 worked days', () => {
    const rows = summarizeUtilization([], [member('a', 5)], { from: '2026-07-06', to: '2026-07-12' });
    expect(rows).toEqual([{ userId: 'a', workedDays: 0, capacityDays: 5, utilizationPct: 0, status: 'under' }]);
  });

  it('is empty for an open-ended range', () => {
    expect(summarizeUtilization([], [member('a', 5)], {})).toEqual([]);
  });
});

function timeEntry(
  overrides: Partial<{
    project_id: string;
    user_id: string;
    duration_minutes: number;
    status: 'pending' | 'approved' | 'rejected';
    billable: boolean;
    invoice_id: string | null;
    project: { name: string; color: string | null; hours_per_day: number; default_tjm_cents: number | null } | null;
  }> = {},
): TimeEntryWithProject {
  return {
    id: 'e1',
    project_id: 'p1',
    user_id: 'u1',
    company_id: 'c1',
    entry_date: '2026-07-06',
    duration_minutes: 480,
    description: null,
    billable: true,
    status: 'approved',
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    invoice_id: null,
    tags: [],
    created_at: '',
    updated_at: '',
    deleted: false,
    project: { name: 'Project 1', color: null, hours_per_day: 8, default_tjm_cents: 60000 },
    ...overrides,
  };
}

function projectMember(userId: string, projectId: string, tjmCents: number | null): ProjectMember {
  return {
    id: `${projectId}:${userId}`,
    project_id: projectId,
    user_id: userId,
    tjm_cents: tjmCents,
    role_on_project: 'member',
    created_at: '',
    updated_at: '',
    deleted: false,
  };
}

describe('uninvoicedTimeByProject', () => {
  it('values approved uninvoiced time at the project default rate', () => {
    const totals = uninvoicedTimeByProject([timeEntry()], new Map());
    expect(totals.get('p1')).toBe(60000); // 1 day (8h/480min) * 60000
  });

  it('buckets by project and uses each project s own rate', () => {
    const totals = uninvoicedTimeByProject(
      [
        timeEntry({ project_id: 'p1', project: { name: 'P1', color: null, hours_per_day: 8, default_tjm_cents: 60000 } }),
        timeEntry({ project_id: 'p2', project: { name: 'P2', color: null, hours_per_day: 8, default_tjm_cents: 40000 } }),
      ],
      new Map(),
    );
    expect(totals.get('p1')).toBe(60000);
    expect(totals.get('p2')).toBe(40000);
  });

  it("uses a freelancer's per-project tjm override over the project default", () => {
    const totals = uninvoicedTimeByProject(
      [timeEntry({ project_id: 'p1', user_id: 'u1' })],
      new Map([['p1', [projectMember('u1', 'p1', 50000)]]]),
    );
    expect(totals.get('p1')).toBe(50000);
  });

  it('excludes pending, non-billable, invoiced and deleted entries', () => {
    const totals = uninvoicedTimeByProject(
      [
        timeEntry({ status: 'pending' }),
        timeEntry({ billable: false }),
        timeEntry({ invoice_id: 'inv-1' }),
        { ...timeEntry(), deleted: true },
      ],
      new Map(),
    );
    expect(totals.get('p1') ?? 0).toBe(0);
  });

  it('ignores entries whose project join is missing', () => {
    const totals = uninvoicedTimeByProject([timeEntry({ project: null })], new Map());
    expect(totals.size).toBe(0);
  });

  it('is empty for no entries', () => {
    expect(uninvoicedTimeByProject([], new Map()).size).toBe(0);
  });
});
