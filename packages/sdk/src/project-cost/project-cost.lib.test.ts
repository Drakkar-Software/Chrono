import { describe, expect, it } from 'vitest';
import {
  costCumulative,
  costForMonth,
  expensesOwedByUser,
  reimbursementsOwed,
  sumApprovedExpenses,
  totalCostForMonth,
  unpaidPoolCosts,
} from './project-cost.lib';

// A recurring cost that deducts straight from revenue every month — the common
// case, and the shape existing fixed costs are backfilled to.
const recurring = {
  kind: 'recurring' as const,
  amount_cents: 2000,
  active: true,
  paid_at: null as string | null,
  auto_deduct: true,
  period_month: null,
  starts_on: '2026-01-01',
  ends_on: null as string | null,
};

// A one_off only counts once actually paid.
const oneOff = {
  kind: 'one_off' as const,
  amount_cents: 50000,
  active: true,
  paid_at: '2026-03-05T00:00:00Z' as string | null,
  auto_deduct: false,
  period_month: '2026-03-01' as string | null,
  starts_on: null,
  ends_on: null,
};

describe('costForMonth', () => {
  it('counts a recurring cost every month within its open-ended window', () => {
    expect(costForMonth(recurring, '2026-01')).toBe(2000);
    expect(costForMonth(recurring, '2026-06')).toBe(2000);
  });

  it('is 0 for a recurring cost before it starts', () => {
    expect(costForMonth(recurring, '2025-12')).toBe(0);
  });

  it('respects a recurring cost end date', () => {
    const bounded = { ...recurring, ends_on: '2026-03-01' };
    expect(costForMonth(bounded, '2026-03')).toBe(2000);
    expect(costForMonth(bounded, '2026-04')).toBe(0);
  });

  it('counts a one_off cost only in its own month', () => {
    expect(costForMonth(oneOff, '2026-03')).toBe(50000);
    expect(costForMonth(oneOff, '2026-04')).toBe(0);
  });

  it('is 0 when inactive', () => {
    expect(costForMonth({ ...recurring, active: false }, '2026-01')).toBe(0);
  });
});

// The paid gate — the pool only ever sees money that actually went out, the
// mirror of revenue_entries.paid_at.
describe('costForMonth paid gate', () => {
  it('ignores an unpaid one_off', () => {
    expect(costForMonth({ ...oneOff, paid_at: null }, '2026-03')).toBe(0);
  });

  it('ignores a recurring cost that neither auto-deducts nor is paid', () => {
    expect(costForMonth({ ...recurring, auto_deduct: false, paid_at: null }, '2026-01')).toBe(0);
  });

  it('counts a manually-paid recurring cost even without auto_deduct', () => {
    const manual = { ...recurring, auto_deduct: false, paid_at: '2026-01-15T00:00:00Z' };
    expect(costForMonth(manual, '2026-01')).toBe(2000);
  });

  it('never counts a reimbursable — it is paid outside the pool', () => {
    const reimbursable = {
      ...oneOff,
      kind: 'reimbursable' as const,
      paid_at: null,
      period_month: null,
    };
    expect(costForMonth(reimbursable, '2026-03')).toBe(0);
  });
});

describe('totalCostForMonth', () => {
  it('sums every applicable cost for the month', () => {
    expect(totalCostForMonth([recurring, oneOff], '2026-03')).toBe(52000);
    expect(totalCostForMonth([recurring, oneOff], '2026-04')).toBe(2000);
  });
});

describe('costCumulative', () => {
  it('multiplies a recurring cost by elapsed months, inclusive', () => {
    // Jan, Feb, Mar = 3 months * 2000
    expect(costCumulative([recurring], '2026-03')).toBe(6000);
  });

  it('is 0 through a month before the recurring cost starts', () => {
    expect(costCumulative([recurring], '2025-12')).toBe(0);
  });

  it('caps elapsed months at the cost end date', () => {
    const bounded = { ...recurring, ends_on: '2026-02-01' };
    // Jan, Feb only, even when asked through June
    expect(costCumulative([bounded], '2026-06')).toBe(4000);
  });

  it('includes a one_off cost once its month has arrived, matching settle', () => {
    expect(costCumulative([oneOff], '2026-02')).toBe(0);
    expect(costCumulative([oneOff], '2026-03')).toBe(50000);
    expect(costCumulative([oneOff], '2026-12')).toBe(50000);
  });

  it('sums recurring and one_off together', () => {
    // Through March: recurring 3*2000=6000 + one_off 50000 = 56000
    expect(costCumulative([recurring, oneOff], '2026-03')).toBe(56000);
  });

  it('excludes unpaid costs from the pool', () => {
    expect(costCumulative([{ ...oneOff, paid_at: null }], '2026-12')).toBe(0);
    expect(costCumulative([{ ...recurring, auto_deduct: false, paid_at: null }], '2026-03')).toBe(0);
  });
});

describe('unpaidPoolCosts', () => {
  it('surfaces committed-but-unpaid pool costs only', () => {
    const unpaidOneOff = { ...oneOff, paid_at: null };
    const unpaidRecurring = { ...recurring, auto_deduct: false, paid_at: null };
    const rows = unpaidPoolCosts([recurring, oneOff, unpaidOneOff, unpaidRecurring]);
    expect(rows).toEqual([unpaidOneOff, unpaidRecurring]);
  });
});

const approved = (
  overrides: Partial<{ user_id: string; amount_cents: number; reimbursed_at: string | null }> = {},
) => ({
  kind: 'reimbursable' as const,
  user_id: 'u1',
  amount_cents: 1000,
  status: 'approved' as const,
  reimbursed_at: null,
  ...overrides,
});

describe('sumApprovedExpenses', () => {
  it('sums only approved reimbursables', () => {
    expect(
      sumApprovedExpenses([
        approved({ amount_cents: 1000 }),
        { kind: 'reimbursable', user_id: 'u1', amount_cents: 500, status: 'pending' },
        { kind: 'reimbursable', user_id: 'u1', amount_cents: 200, status: 'rejected' },
      ]),
    ).toBe(1000);
  });

  it('is 0 for an empty list', () => {
    expect(sumApprovedExpenses([])).toBe(0);
  });

  it('ignores pool costs sharing the table', () => {
    expect(sumApprovedExpenses([{ kind: 'recurring', amount_cents: 9999, status: null }])).toBe(0);
  });
});

describe('reimbursementsOwed', () => {
  it('keeps approved reimbursables with no reimbursed_at', () => {
    const owed = reimbursementsOwed([
      approved({ reimbursed_at: null }),
      approved({ reimbursed_at: '2026-07-01T00:00:00Z' }),
      { kind: 'reimbursable', user_id: 'u1', amount_cents: 500, status: 'pending', reimbursed_at: null },
    ]);
    expect(owed).toHaveLength(1);
  });
});

describe('expensesOwedByUser', () => {
  it('sums owed cents per freelancer', () => {
    const owed = expensesOwedByUser([
      approved({ user_id: 'a', amount_cents: 1000 }),
      approved({ user_id: 'a', amount_cents: 500 }),
      approved({ user_id: 'b', amount_cents: 200 }),
      approved({ user_id: 'a', amount_cents: 300, reimbursed_at: '2026-07-01T00:00:00Z' }),
    ]);
    expect(owed).toEqual({ a: 1500, b: 200 });
  });

  it('is empty when nothing is owed', () => {
    expect(expensesOwedByUser([])).toEqual({});
  });
});
