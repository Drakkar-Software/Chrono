import { describe, expect, it } from 'vitest';
import { projectStatusLabel, remainingBudget } from './project.lib';

describe('projectStatusLabel', () => {
  it('labels every status', () => {
    expect(projectStatusLabel('active')).toBe('Active');
    expect(projectStatusLabel('archived')).toBe('Archived');
  });
});

describe('remainingBudget', () => {
  it('is null when the project has no budget cap', () => {
    expect(remainingBudget({ budget_cents: null }, 50000)).toBeNull();
  });

  it('is the positive remainder under budget', () => {
    expect(remainingBudget({ budget_cents: 100000 }, 30000)).toBe(70000);
  });

  it('goes negative when over budget', () => {
    expect(remainingBudget({ budget_cents: 100000 }, 130000)).toBe(-30000);
  });

  it('is the full budget when nothing is paid', () => {
    expect(remainingBudget({ budget_cents: 100000 }, 0)).toBe(100000);
  });
});
