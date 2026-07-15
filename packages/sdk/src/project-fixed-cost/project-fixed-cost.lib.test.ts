import { describe, expect, it } from 'vitest';
import { fixedCostCumulative, fixedCostForMonth, totalFixedCostForMonth } from './project-fixed-cost.lib';

const recurring = {
  cadence: 'recurring' as const,
  amount_cents: 2000,
  active: true,
  period_month: null,
  starts_on: '2026-01-01',
  ends_on: null as string | null,
};

const oneOff = {
  cadence: 'one_off' as const,
  amount_cents: 50000,
  active: true,
  period_month: '2026-03-01' as string | null,
  starts_on: null,
  ends_on: null,
};

describe('fixedCostForMonth', () => {
  it('counts a recurring cost every month within its open-ended window', () => {
    expect(fixedCostForMonth(recurring, '2026-01')).toBe(2000);
    expect(fixedCostForMonth(recurring, '2026-06')).toBe(2000);
  });

  it('is 0 for a recurring cost before it starts', () => {
    expect(fixedCostForMonth(recurring, '2025-12')).toBe(0);
  });

  it('respects a recurring cost end date', () => {
    const bounded = { ...recurring, ends_on: '2026-03-01' };
    expect(fixedCostForMonth(bounded, '2026-03')).toBe(2000);
    expect(fixedCostForMonth(bounded, '2026-04')).toBe(0);
  });

  it('counts a one_off cost only in its own month', () => {
    expect(fixedCostForMonth(oneOff, '2026-03')).toBe(50000);
    expect(fixedCostForMonth(oneOff, '2026-04')).toBe(0);
  });

  it('is 0 when inactive', () => {
    expect(fixedCostForMonth({ ...recurring, active: false }, '2026-01')).toBe(0);
  });
});

describe('totalFixedCostForMonth', () => {
  it('sums every applicable cost for the month', () => {
    expect(totalFixedCostForMonth([recurring, oneOff], '2026-03')).toBe(52000);
    expect(totalFixedCostForMonth([recurring, oneOff], '2026-04')).toBe(2000);
  });
});

describe('fixedCostCumulative', () => {
  it('multiplies a recurring cost by elapsed months, inclusive', () => {
    // Jan, Feb, Mar = 3 months * 2000
    expect(fixedCostCumulative([recurring], '2026-03')).toBe(6000);
  });

  it('is 0 through a month before the recurring cost starts', () => {
    expect(fixedCostCumulative([recurring], '2025-12')).toBe(0);
  });

  it('caps elapsed months at the cost end date', () => {
    const bounded = { ...recurring, ends_on: '2026-02-01' };
    // Jan, Feb only, even when asked through June
    expect(fixedCostCumulative([bounded], '2026-06')).toBe(4000);
  });

  it('includes a one_off cost once its month has arrived, matching settle', () => {
    expect(fixedCostCumulative([oneOff], '2026-02')).toBe(0);
    expect(fixedCostCumulative([oneOff], '2026-03')).toBe(50000);
    expect(fixedCostCumulative([oneOff], '2026-12')).toBe(50000);
  });

  it('sums recurring and one_off together', () => {
    // Through March: recurring 3*2000=6000 + one_off 50000 = 56000
    expect(fixedCostCumulative([recurring, oneOff], '2026-03')).toBe(56000);
  });
});
