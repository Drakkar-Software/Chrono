import { describe, expect, it } from 'vitest';
import { expensesOwedByUser, reimbursementsOwed, sumApprovedExpenses } from './project-expense.lib';

const approved = (overrides: Partial<{ user_id: string; amount_cents: number; reimbursed_at: string | null }> = {}) => ({
  user_id: 'u1',
  amount_cents: 1000,
  status: 'approved' as const,
  reimbursed_at: null,
  ...overrides,
});

describe('sumApprovedExpenses', () => {
  it('sums only approved expenses', () => {
    expect(
      sumApprovedExpenses([
        approved({ amount_cents: 1000 }),
        { user_id: 'u1', amount_cents: 500, status: 'pending' },
        { user_id: 'u1', amount_cents: 200, status: 'rejected' },
      ]),
    ).toBe(1000);
  });

  it('is 0 for an empty list', () => {
    expect(sumApprovedExpenses([])).toBe(0);
  });
});

describe('reimbursementsOwed', () => {
  it('keeps approved expenses with no reimbursed_at', () => {
    const owed = reimbursementsOwed([
      approved({ reimbursed_at: null }),
      approved({ reimbursed_at: '2026-07-01T00:00:00Z' }),
      { user_id: 'u1', amount_cents: 500, status: 'pending', reimbursed_at: null },
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
