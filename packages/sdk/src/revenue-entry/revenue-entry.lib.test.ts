import { describe, expect, it } from 'vitest';
import {
  availableFunding,
  dueRevenue,
  netAvailableFunding,
  projectMargin,
  recurringRevenue,
  revenueEntryPaid,
  selfBillingRevenue,
  timeBasedRevenue,
} from './revenue-entry.lib';

const PAID = '2026-07-01T00:00:00Z';

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

describe('revenueEntryPaid', () => {
  it('is false when paid_at is null (due by client, the default)', () => {
    expect(revenueEntryPaid({ paid_at: null })).toBe(false);
  });

  it('is true once paid_at is set', () => {
    expect(revenueEntryPaid({ paid_at: PAID })).toBe(true);
  });
});

describe('dueRevenue', () => {
  it('sums only entries not yet marked paid', () => {
    const due = dueRevenue([
      { amount_cents: 500000, paid_at: null },
      { amount_cents: 300000, paid_at: PAID },
    ]);
    expect(due).toBe(500000);
  });

  it('is 0 once everything is paid', () => {
    expect(dueRevenue([{ amount_cents: 500000, paid_at: PAID }])).toBe(0);
  });
});

describe('availableFunding', () => {
  it('counts only PAID revenue toward the pool — due-by-client revenue does not count yet', () => {
    const funding = availableFunding(
      [
        { amount_cents: 500000, paid_at: PAID },
        { amount_cents: 300000, paid_at: null }, // still due — excluded
      ],
      [{ amount_cents: 80000 }],
      [{ amount_paid_cents: 200000 }],
    );
    expect(funding).toBe(220000); // 500000 (paid only) - 80000 - 200000
  });

  it('floors at zero when overdrawn', () => {
    expect(
      availableFunding(
        [{ amount_cents: 100000, paid_at: PAID }],
        [{ amount_cents: 50000 }],
        [{ amount_paid_cents: 100000 }],
      ),
    ).toBe(0);
  });

  it('is 0 for all-empty arrays', () => {
    expect(availableFunding([], [], [])).toBe(0);
  });

  it('treats null amount_cents entries as 0', () => {
    // Revenue rows can carry a null amount_cents; they must contribute nothing.
    const funding = availableFunding(
      [
        { amount_cents: null as unknown as number, paid_at: PAID },
        { amount_cents: 300000, paid_at: PAID },
      ],
      [],
      [],
    );
    expect(funding).toBe(300000);
  });

  it('subtracts fixed costs (e.g. hosting) from the pool', () => {
    const funding = availableFunding(
      [
        { amount_cents: 500000, paid_at: PAID },
        { amount_cents: 300000, paid_at: null },
      ],
      [{ amount_cents: 80000 }],
      [{ amount_paid_cents: 200000 }],
      20000,
    );
    expect(funding).toBe(200000); // 500000 (paid only) - 80000 - 20000 - 200000
  });

  it('defaults fixed costs to 0 when omitted', () => {
    expect(availableFunding([{ amount_cents: 100000, paid_at: PAID }], [], [])).toBe(100000);
  });
});

describe('projectMargin', () => {
  it('is revenue minus referral minus cost', () => {
    expect(projectMargin(800000, 80000, 500000)).toBe(220000);
  });

  it('goes negative when cost exceeds revenue net of referral', () => {
    // 100000 - 20000 - 200000 = -120000
    expect(projectMargin(100000, 20000, 200000)).toBe(-120000);
  });

  it('subtracts fixed costs when provided', () => {
    // 800000 - 80000 - 20000 (fixed) - 500000 = 200000
    expect(projectMargin(800000, 80000, 500000, 20000)).toBe(200000);
  });

  it('subtracts reimbursable expenses when provided', () => {
    // 800000 - 80000 - 20000 (fixed) - 500000 - 15000 (expenses) = 185000
    expect(projectMargin(800000, 80000, 500000, 20000, 15000)).toBe(185000);
  });
});

describe('netAvailableFunding', () => {
  it('is the funding when nothing is pending', () => {
    expect(netAvailableFunding(200000, 0)).toBe(200000);
  });

  it('subtracts what is owed to freelancers from the funding pool', () => {
    expect(netAvailableFunding(200000, 50000)).toBe(150000);
  });

  it('is 0 when funding exactly covers what is owed', () => {
    expect(netAvailableFunding(200000, 200000)).toBe(0);
  });

  it('goes negative when what is owed exceeds the funding pool — NOT floored, unlike availableFunding', () => {
    expect(netAvailableFunding(100000, 150000)).toBe(-50000);
  });

  it('composes with availableFunding as the funding input', () => {
    const funding = availableFunding(
      [{ amount_cents: 500000, paid_at: PAID }],
      [{ amount_cents: 80000 }],
      [{ amount_paid_cents: 200000 }],
    );
    // funding = 220000; owed (unpaid invoice balance + uninvoiced time) = 100000
    expect(netAvailableFunding(funding, 100000)).toBe(120000);
  });
});
