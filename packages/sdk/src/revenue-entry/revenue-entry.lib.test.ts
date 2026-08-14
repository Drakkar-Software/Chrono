import { describe, expect, it } from 'vitest';
import {
  availableFunding,
  dueRevenue,
  isRevenueCorrection,
  netAvailableFunding,
  netRevenueCents,
  netRevenueForSource,
  offsettingCorrectionCents,
  projectMargin,
  recurringRevenue,
  revenueEntryPaid,
  selfBillingRevenue,
  timeBasedRevenue,
} from './revenue-entry.lib';

const PAID = '2026-07-01T00:00:00Z';

describe('recurringRevenue', () => {
  it('multiplies the per-occurrence amount by the occurrences in the month', () => {
    const weekly = {
      type: 'recurring' as const,
      content: { frequency: 'weekly' as const, amount_cents: 50000 },
      starts_on: '2026-03-11',
      ends_on: null,
    };
    // Mar 11, 18, 25 -> 3 x 500€
    expect(recurringRevenue(weekly, '2026-03-01')).toBe(150000);
    // Apr 1, 8, 15, 22, 29 -> 5 x 500€
    expect(recurringRevenue(weekly, '2026-04-01')).toBe(250000);
  });

  it('recognizes nothing in an off-cycle month', () => {
    const quarterly = {
      type: 'recurring' as const,
      content: { frequency: 'quarterly' as const, amount_cents: 300000 },
      starts_on: '2026-03-15',
      ends_on: null,
    };
    expect(recurringRevenue(quarterly, '2026-03-01')).toBe(300000);
    expect(recurringRevenue(quarterly, '2026-04-01')).toBe(0);
    expect(recurringRevenue(quarterly, '2026-06-01')).toBe(300000);
  });

  it('pays one occurrence a month when a frequency has no anchor', () => {
    // Hand-edited / imported row. Paying zero here would drop the revenue
    // silently; the RPC has the same guard.
    const anchorless = {
      type: 'recurring' as const,
      content: { frequency: 'weekly' as const, amount_cents: 70000 },
      starts_on: null,
      ends_on: null,
    };
    expect(recurringRevenue(anchorless, '2026-03-01')).toBe(70000);
    expect(recurringRevenue(anchorless, '2026-04-01')).toBe(70000);
  });

  it('stops at the end date', () => {
    const bounded = {
      type: 'recurring' as const,
      content: { frequency: 'weekly' as const, amount_cents: 20000 },
      starts_on: '2026-03-01',
      ends_on: '2026-03-31',
    };
    // Mar 1, 8, 15, 22, 29
    expect(recurringRevenue(bounded, '2026-03-01')).toBe(100000);
    expect(recurringRevenue(bounded, '2026-04-01')).toBe(0);
  });

  it('bills every calendar day for a daily schedule', () => {
    const daily = {
      type: 'recurring' as const,
      content: { frequency: 'daily' as const, amount_cents: 1000 },
      starts_on: '2026-03-11',
      ends_on: null,
    };
    // Mar 11..31 inclusive, weekends included
    expect(recurringRevenue(daily, '2026-03-01')).toBe(21000);
  });

  it('reads the flat monthly figure for a legacy source, whatever the month', () => {
    const legacy = {
      type: 'recurring' as const,
      content: { monthly_amount_cents: 300000 },
      starts_on: null,
      ends_on: null,
    };
    expect(recurringRevenue(legacy, '2026-03-01')).toBe(300000);
    expect(recurringRevenue(legacy, '2026-04-01')).toBe(300000);
  });

  it('is 0 for non-recurring sources', () => {
    expect(
      recurringRevenue(
        {
          type: 'time_based',
          content: { client_tjm_cents: 60000 },
          starts_on: null,
          ends_on: null,
        },
        '2026-03-01',
      ),
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

  it('shrinks when an unpaid correction offsets unpaid recognition', () => {
    expect(
      dueRevenue([
        { amount_cents: 500000, paid_at: null },
        { amount_cents: -200000, paid_at: null },
      ]),
    ).toBe(300000);
  });

  it('ignores paid corrections when computing unpaid due', () => {
    expect(
      dueRevenue([
        { amount_cents: 500000, paid_at: null },
        { amount_cents: -100000, paid_at: PAID },
      ]),
    ).toBe(500000);
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

  it('reduces the pool when a paid correction offsets paid recognition', () => {
    const funding = availableFunding(
      [
        { amount_cents: 500000, paid_at: PAID },
        { amount_cents: -200000, paid_at: PAID },
      ],
      [],
      [],
    );
    expect(funding).toBe(300000);
  });

  it('floors at zero when paid corrections wipe the paid pool', () => {
    expect(
      availableFunding(
        [
          { amount_cents: 100000, paid_at: PAID },
          { amount_cents: -100000, paid_at: PAID },
        ],
        [],
        [],
      ),
    ).toBe(0);
  });
});

describe('isRevenueCorrection / net helpers', () => {
  it('flags only non-auto negative entries as corrections', () => {
    expect(isRevenueCorrection({ amount_cents: -50000, auto_generated: false })).toBe(true);
    expect(isRevenueCorrection({ amount_cents: 50000, auto_generated: false })).toBe(false);
    expect(isRevenueCorrection({ amount_cents: -50000, auto_generated: true })).toBe(false);
  });

  it('nets signed amounts across entries', () => {
    expect(
      netRevenueCents([
        { amount_cents: 500000 },
        { amount_cents: -200000 },
        { amount_cents: 100000 },
      ]),
    ).toBe(400000);
  });

  it('nets per source id', () => {
    expect(
      netRevenueForSource(
        [
          { revenue_source_id: 'a', amount_cents: 500000 },
          { revenue_source_id: 'a', amount_cents: -500000 },
          { revenue_source_id: 'b', amount_cents: 100000 },
        ],
        'a',
      ),
    ).toBe(0);
  });

  it('mirrors correct_revenue_source offset math', () => {
    expect(offsettingCorrectionCents(500000)).toBe(-500000);
    expect(offsettingCorrectionCents(0)).toBeNull();
    expect(offsettingCorrectionCents(-100)).toBeNull();
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
