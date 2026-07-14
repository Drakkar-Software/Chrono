import { describe, expect, it } from 'vitest';
import {
  availableFunding,
  projectMargin,
  recurringRevenue,
  selfBillingRevenue,
  timeBasedRevenue,
} from './revenue-entry.lib';

describe('recurringRevenue', () => {
  it('reads monthly_amount_cents for recurring sources', () => {
    expect(
      recurringRevenue({
        type: 'recurring',
        content: { monthly_amount_cents: 300000 },
      }),
    ).toBe(300000);
  });

  it('is 0 for non-recurring sources', () => {
    expect(
      recurringRevenue({
        type: 'time_based',
        content: { client_tjm_cents: 60000 },
      }),
    ).toBe(0);
  });
});

describe('timeBasedRevenue', () => {
  it('rounds billableDays * clientTjmCents', () => {
    expect(timeBasedRevenue(10, 60000)).toBe(600000);
    // 3.5714 days * 60000 = 214285.7 -> 214286
    expect(timeBasedRevenue(3.5714, 60000)).toBe(214284);
  });
});

describe('selfBillingRevenue', () => {
  it('applies a markup on top of the time-based amount', () => {
    // base 600000, +15% => 690000
    expect(selfBillingRevenue(10, 60000, 15)).toBe(690000);
  });

  it('defaults to no markup', () => {
    expect(selfBillingRevenue(10, 60000)).toBe(600000);
  });
});

describe('availableFunding', () => {
  it('is cumulative revenue minus referrals minus paid invoices', () => {
    const funding = availableFunding(
      [{ amount_cents: 500000 }, { amount_cents: 300000 }],
      [{ amount_cents: 80000 }],
      [{ amount_paid_cents: 200000 }],
    );
    expect(funding).toBe(520000); // 800000 - 80000 - 200000
  });

  it('floors at zero when overdrawn', () => {
    expect(
      availableFunding(
        [{ amount_cents: 100000 }],
        [{ amount_cents: 50000 }],
        [{ amount_paid_cents: 100000 }],
      ),
    ).toBe(0);
  });
});

describe('projectMargin', () => {
  it('is revenue minus referral minus cost', () => {
    expect(projectMargin(800000, 80000, 500000)).toBe(220000);
  });
});
