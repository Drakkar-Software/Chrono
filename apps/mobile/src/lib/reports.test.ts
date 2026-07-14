import { describe, expect, it } from 'vitest';
import { lastMonths, monthlyTrend } from './reports';

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
      '2026-03-10',
      2,
    );
    expect(rows).toEqual([
      { month: '2026-02', revenueCents: 50000, costCents: 0, marginCents: 50000 },
      // margin = 100000 revenue - 10000 referral - 40000 cost = 50000
      { month: '2026-03', revenueCents: 100000, costCents: 40000, marginCents: 50000 },
    ]);
  });

  it('yields zeroed months with no activity', () => {
    const rows = monthlyTrend([], [], [], '2026-03-10', 2);
    expect(rows.every((r) => r.revenueCents === 0 && r.costCents === 0 && r.marginCents === 0)).toBe(true);
  });
});
