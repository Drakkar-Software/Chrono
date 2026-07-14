import { describe, expect, it } from 'vitest';
import { budgetUsage } from './project.lib';

describe('budgetUsage', () => {
  it('is "none" without a budget cap', () => {
    expect(budgetUsage({ budget_cents: null }, 100000).status).toBe('none');
    expect(budgetUsage({ budget_cents: 0 }, 100000).status).toBe('none');
  });

  it('classifies ok / warning / over around the threshold', () => {
    expect(budgetUsage({ budget_cents: 100000 }, 50000).status).toBe('ok');
    expect(budgetUsage({ budget_cents: 100000 }, 79000).status).toBe('ok');
    expect(budgetUsage({ budget_cents: 100000 }, 80000).status).toBe('warning');
    expect(budgetUsage({ budget_cents: 100000 }, 99000).status).toBe('warning');
    expect(budgetUsage({ budget_cents: 100000 }, 100000).status).toBe('over');
    expect(budgetUsage({ budget_cents: 100000 }, 130000).status).toBe('over');
  });

  it('reports ratio and remaining', () => {
    const u = budgetUsage({ budget_cents: 200000 }, 150000);
    expect(u.ratio).toBeCloseTo(0.75);
    expect(u.remainingCents).toBe(50000);
  });

  it('honors a custom warn threshold', () => {
    expect(budgetUsage({ budget_cents: 100000 }, 60000, 0.5).status).toBe('warning');
  });
});
