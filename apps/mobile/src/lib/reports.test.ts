import { describe, expect, it } from 'vitest';
import { lastMonths, monthlyTrend, summarizeUtilization } from './reports';
import type { CompanyMemberWithProfile } from '@chrono/sdk';

describe('lastMonths', () => {
  it('returns N ascending month keys ending at today', () => {
    expect(lastMonths('2026-03-15', 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
  });

  it('wraps across year boundaries', () => {
    expect(lastMonths('2026-01-10', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

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
      { month: '2026-02', revenueCents: 50000, costCents: 0, fixedCostCents: 0, marginCents: 50000 },
      // margin = 100000 revenue - 10000 referral - 40000 cost = 50000
      { month: '2026-03', revenueCents: 100000, costCents: 40000, fixedCostCents: 0, marginCents: 50000 },
    ]);
  });

  it('subtracts each month\'s applicable fixed cost from margin', () => {
    const rows = monthlyTrend(
      [{ period_month: '2026-03-01', amount_cents: 100000 }],
      [],
      [],
      [
        {
          cadence: 'recurring',
          amount_cents: 2000,
          active: true,
          period_month: null,
          starts_on: '2026-01-01',
          ends_on: null,
        } as unknown as import('@chrono/sdk').ProjectFixedCost,
      ],
      '2026-03-10',
      2,
    );
    expect(rows).toEqual([
      { month: '2026-02', revenueCents: 0, costCents: 0, fixedCostCents: 2000, marginCents: -2000 },
      { month: '2026-03', revenueCents: 100000, costCents: 0, fixedCostCents: 2000, marginCents: 98000 },
    ]);
  });

  it('yields zeroed months with no activity', () => {
    const rows = monthlyTrend([], [], [], [], '2026-03-10', 2);
    expect(
      rows.every(
        (r) => r.revenueCents === 0 && r.costCents === 0 && r.fixedCostCents === 0 && r.marginCents === 0,
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
