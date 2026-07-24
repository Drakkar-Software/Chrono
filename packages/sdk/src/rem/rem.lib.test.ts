import { describe, expect, it } from 'vitest';
import {
  PRODUCT_POOL_BASE,
  PRODUCT_SERVICE_BASE,
  USER_G,
  USER_P,
  USER_X,
} from './rem.fixtures';
import {
  cappedTimeShares,
  companyFeeCents,
  computeExternalTjmMonth,
  computeProductPoolRem,
  computeProductServiceRem,
  dequeueJungleFifo,
  enqueueJungleCents,
  equalSplitCents,
  externalContractRemCents,
  partnerTakeHomeCents,
  productPoolDaysForExternal,
  splitCentsByShares,
  staffingTjmRemCents,
  sumRemLinesByBucket,
  sumRemLinesByUser,
  vacationDaysFromTimeOff,
  visibleRemLines,
} from './rem.lib';
import { computeEarnedCents } from '../time-entry/time-entry.lib';

describe('companyFeeCents', () => {
  it('A1 fee 5% of (7000−500)€', () => {
    const afterCosts =
      PRODUCT_POOL_BASE.direct_sales_cents +
      PRODUCT_POOL_BASE.maintenance_cents -
      PRODUCT_POOL_BASE.costs_cents;
    expect(companyFeeCents(afterCosts, 5)).toBe(PRODUCT_POOL_BASE.expected_fee_cents);
  });
  it('returns 0 for 0 pct or non-positive revenue', () => {
    expect(companyFeeCents(100_000, 0)).toBe(0);
    expect(companyFeeCents(0, 5)).toBe(0);
  });
});

describe('cappedTimeShares', () => {
  it('F1 two partners uncapped 50/50', () => {
    const s = cappedTimeShares(
      [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
      ],
      0.75,
    );
    expect(s.find((x) => x.user_id === USER_G)?.share).toBeCloseTo(0.5, 10);
    expect(s.find((x) => x.user_id === USER_P)?.share).toBeCloseTo(0.5, 10);
  });

  it('F2 one above max → capped; other gets remainder', () => {
    const s = cappedTimeShares(
      [
        { user_id: USER_G, time_weight: 95 },
        { user_id: USER_P, time_weight: 5 },
      ],
      0.75,
    );
    expect(s.find((x) => x.user_id === USER_G)?.share).toBeCloseTo(0.75, 10);
    expect(s.find((x) => x.user_id === USER_P)?.share).toBeCloseTo(0.25, 10);
  });

  it('F3 both would exceed max → scale to sum 1 (may exceed max when N×max < 1)', () => {
    const s = cappedTimeShares(
      [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
      ],
      0.4,
    );
    const sum = s.reduce((a, x) => a + x.share, 0);
    expect(sum).toBeCloseTo(1, 10);
    // 2 × 0.4 < 1 → equal 0.5 after scale
    expect(s[0].share).toBeCloseTo(0.5, 10);
    expect(s[1].share).toBeCloseTo(0.5, 10);
  });

  it('F4 N=3 one capped, redistribute', () => {
    const s = cappedTimeShares(
      [
        { user_id: USER_G, time_weight: 80 },
        { user_id: USER_P, time_weight: 10 },
        { user_id: USER_X, time_weight: 10 },
      ],
      0.5,
    );
    expect(s.find((x) => x.user_id === USER_G)?.share).toBeCloseTo(0.5, 10);
    const rest =
      (s.find((x) => x.user_id === USER_P)?.share ?? 0) +
      (s.find((x) => x.user_id === USER_X)?.share ?? 0);
    expect(rest).toBeCloseTo(0.5, 10);
  });

  it('F5 idempotent', () => {
    const input = [
      { user_id: USER_G, time_weight: 90 },
      { user_id: USER_P, time_weight: 10 },
    ];
    const a = cappedTimeShares(input, 0.75);
    const b = cappedTimeShares(
      a.map((x) => ({
        user_id: x.user_id,
        time_weight: x.share,
        max_fraction: 0.75,
      })),
      0.75,
    );
    expect(b.find((x) => x.user_id === USER_G)?.share).toBeCloseTo(
      a.find((x) => x.user_id === USER_G)?.share ?? 0,
      8,
    );
  });

  it('F6 property-style random TP', () => {
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 40; i++) {
      const n = 2 + Math.floor(rnd() * 4);
      const max = 0.3 + rnd() * 0.7;
      const partners = Array.from({ length: n }, (_, j) => ({
        user_id: `u${j}`,
        time_weight: rnd() * 10,
      }));
      const s = cappedTimeShares(partners, max);
      const sum = s.reduce((a, x) => a + x.share, 0);
      expect(sum).toBeCloseTo(1, 8);
      const canHonorCap = n * max >= 1 - 1e-9;
      for (const x of s) {
        expect(x.share).toBeGreaterThanOrEqual(-1e-9);
        if (canHonorCap) {
          expect(x.share).toBeLessThanOrEqual(max + 1e-6);
        }
      }
    }
  });

  it('zero weights → equal split', () => {
    const s = cappedTimeShares(
      [
        { user_id: USER_G, time_weight: 0 },
        { user_id: USER_P, time_weight: 0 },
      ],
      1,
    );
    expect(s[0].share).toBeCloseTo(0.5, 10);
    expect(s[1].share).toBeCloseTo(0.5, 10);
  });
});

describe('computeProductPoolRem', () => {
  const basePartners = (g: number, p: number) => [
    { user_id: USER_G, time_weight: g },
    { user_id: USER_P, time_weight: p },
  ];

  it('A1 50/50 → 308750 each', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: basePartners(1, 1),
      default_max_fraction: 0.75,
    });
    expect(r.net_cents).toBe(617_500);
    expect(r.company_fee_cents).toBe(PRODUCT_POOL_BASE.expected_fee_cents);
    const by = sumRemLinesByUser(r.lines);
    expect(by[USER_G]).toBe(308_750);
    expect(by[USER_P]).toBe(308_750);
  });

  it('A2 30/70', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: basePartners(30, 70),
      default_max_fraction: 1,
    });
    const by = sumRemLinesByUser(r.lines);
    expect(by[USER_G]).toBe(Math.round(617_500 * 0.3));
    expect(by[USER_P]).toBe(Math.round(617_500 * 0.7));
  });

  it('A3 95/5 + MAX 75%', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: basePartners(95, 5),
      default_max_fraction: 0.75,
    });
    const by = sumRemLinesByUser(r.lines);
    expect(by[USER_G]).toBe(Math.round(617_500 * 0.75));
    expect(by[USER_P]).toBe(Math.round(617_500 * 0.25));
  });

  it('A4 fee 0%', () => {
    const r = computeProductPoolRem({
      direct_sales_cents: 400_000,
      maintenance_cents: 300_000,
      costs_cents: 50_000,
      company_fee_pct: 0,
      partners: basePartners(1, 1),
      default_max_fraction: 1,
    });
    expect(r.net_cents).toBe(650_000);
    expect(r.company_fee_cents).toBe(0);
  });

  it('A5 costs > gross → net 0', () => {
    const r = computeProductPoolRem({
      direct_sales_cents: 10_000,
      maintenance_cents: 0,
      costs_cents: 50_000,
      company_fee_pct: 5,
      partners: basePartners(1, 1),
      default_max_fraction: 1,
    });
    expect(r.net_cents).toBe(0);
    expect(sumRemLinesByUser(r.lines)).toEqual({});
  });

  it('A6 single partner 100%', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: [{ user_id: USER_G, time_weight: 1 }],
      default_max_fraction: 1,
    });
    expect(sumRemLinesByUser(r.lines)[USER_G]).toBe(617_500);
  });

  it('A7 MAX 100% → pure TP', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: basePartners(95, 5),
      default_max_fraction: 1,
    });
    expect(sumRemLinesByUser(r.lines)[USER_G]).toBe(Math.round(617_500 * 0.95));
  });

  it('A8 per-member max override', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: [
        { user_id: USER_G, time_weight: 90, max_fraction: 0.6 },
        { user_id: USER_P, time_weight: 10 },
      ],
      default_max_fraction: 0.9,
    });
    const shares = r.shares.find((s) => s.user_id === USER_G)?.share;
    expect(shares).toBeCloseTo(0.6, 10);
  });

  it('A9 zero time → equal split', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: basePartners(0, 0),
      default_max_fraction: 1,
    });
    const by = sumRemLinesByUser(r.lines);
    expect(by[USER_G]).toBe(308_750);
    expect(by[USER_P]).toBe(308_750);
  });

  it('A10 maintenance ignores referral (fee still applied)', () => {
    const r = computeProductPoolRem({
      direct_sales_cents: 0,
      maintenance_cents: 300_000,
      costs_cents: 0,
      company_fee_pct: 5,
      partners: basePartners(1, 1),
      default_max_fraction: 1,
    });
    expect(r.company_fee_cents).toBe(15_000);
    expect(r.net_cents).toBe(285_000);
  });

  it('A11 direct only / maintenance only', () => {
    const d = computeProductPoolRem({
      direct_sales_cents: 400_000,
      maintenance_cents: 0,
      costs_cents: 0,
      company_fee_pct: 5,
      partners: basePartners(1, 0),
      default_max_fraction: 1,
    });
    expect(d.net_cents).toBe(380_000);
    const m = computeProductPoolRem({
      direct_sales_cents: 0,
      maintenance_cents: 300_000,
      costs_cents: 0,
      company_fee_pct: 5,
      partners: basePartners(0, 1),
      default_max_fraction: 1,
    });
    expect(m.net_cents).toBe(285_000);
  });

  it('A12 rounding 3 partners on 617500', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
        { user_id: USER_X, time_weight: 1 },
      ],
      default_max_fraction: 1,
    });
    const by = sumRemLinesByUser(r.lines);
    const sum = (by[USER_G] ?? 0) + (by[USER_P] ?? 0) + (by[USER_X] ?? 0);
    expect(sum).toBe(617_500);
  });
});

describe('computeProductServiceRem', () => {
  it('B1 50/50 + license 1/2 + no referral', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 0,
      referrer_user_ids: [],
      time_partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
      ],
      license_partner_ids: [USER_G, USER_P],
    });
    expect(r.fee_cents).toBe(48_000);
    expect(r.license_cents).toBe(273_600);
    expect(r.pool_cents).toBe(638_400);
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBe(319_200 + 136_800);
    expect(partnerTakeHomeCents(r.lines, USER_P)).toBe(319_200 + 136_800);
  });

  it('B2 60/40 + referral to G', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 10,
      referrer_user_ids: [USER_G],
      time_partners: [
        { user_id: USER_G, time_weight: 60 },
        { user_id: USER_P, time_weight: 40 },
      ],
      license_partner_ids: [USER_G, USER_P],
    });
    expect(r.referral_cents).toBe(96_000);
    expect(r.pool_cents).toBe(542_400);
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBe(
      Math.round(542_400 * 0.6) + 136_800 + 96_000,
    );
    expect(partnerTakeHomeCents(r.lines, USER_P)).toBe(
      Math.round(542_400 * 0.4) + 136_800,
    );
  });

  it('B3 100/0 + referral to P', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 10,
      referrer_user_ids: [USER_P],
      time_partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 0 },
      ],
      license_partner_ids: [USER_G, USER_P],
    });
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBe(542_400 + 136_800);
    expect(partnerTakeHomeCents(r.lines, USER_P)).toBe(136_800 + 96_000);
  });

  it('B4 license 0', () => {
    const r = computeProductServiceRem({
      revenue_cents: 960_000,
      company_fee_pct: 5,
      license_pct: 0,
      referral_pct: 0,
      referrer_user_ids: [],
      time_partners: [{ user_id: USER_G, time_weight: 1 }],
      license_partner_ids: [USER_G],
    });
    expect(r.license_cents).toBe(0);
    expect(r.pool_cents).toBe(912_000);
    expect(sumRemLinesByBucket(r.lines).license).toBeUndefined();
  });

  it('B5 referral 0 → no referral bucket', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 0,
      referrer_user_ids: [USER_G],
      time_partners: [{ user_id: USER_G, time_weight: 1 }],
      license_partner_ids: [USER_G],
    });
    expect(sumRemLinesByBucket(r.lines).referral).toBeUndefined();
  });

  it('B6 stacking meta', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 10,
      referrer_user_ids: [USER_G],
      time_partners: [{ user_id: USER_G, time_weight: 1 }],
      license_partner_ids: [USER_G],
    });
    expect(r.fee_cents + r.license_cents + r.referral_cents + r.pool_cents).toBe(
      PRODUCT_SERVICE_BASE.revenue_cents,
    );
  });

  it('B7 N=4 license equal split', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const parts = equalSplitCents(273_600, ids);
    expect(parts.reduce((s, p) => s + p.amount_cents, 0)).toBe(273_600);
    expect(parts.every((p) => p.amount_cents === 68_400)).toBe(true);
  });

  it('B8 non-partner gets TP not license', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 0,
      referrer_user_ids: [],
      time_partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_X, time_weight: 1 },
      ],
      license_partner_ids: [USER_G, USER_P],
    });
    expect(partnerTakeHomeCents(r.lines, USER_X)).toBe(319_200);
    expect(
      r.lines.some((l) => l.user_id === USER_X && l.bucket === 'license'),
    ).toBe(false);
    expect(partnerTakeHomeCents(r.lines, USER_P)).toBe(136_800);
  });

  it('B9 multi-referrer equal split of referral', () => {
    const r = computeProductServiceRem({
      ...PRODUCT_SERVICE_BASE,
      referral_pct: 10,
      referrer_user_ids: [USER_G, USER_P],
      time_partners: [{ user_id: USER_G, time_weight: 1 }],
      license_partner_ids: [USER_G],
    });
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBeGreaterThan(0);
    const refG = r.lines.find((l) => l.user_id === USER_G && l.bucket === 'referral');
    const refP = r.lines.find((l) => l.user_id === USER_P && l.bucket === 'referral');
    expect((refG?.amount_cents ?? 0) + (refP?.amount_cents ?? 0)).toBe(96_000);
  });
});

describe('external_tjm + residual', () => {
  it('C1 P/G-style month', () => {
    // P: C1 6d@500, C2 1d@1000 ref10%, C3 1d@800 → contract + residual
    const c1 = externalContractRemCents({
      project_id: 'c1',
      days: 6,
      tjm_cents: 50_000,
      referral_pct: 10,
      user_id: USER_P,
    });
    const c2 = externalContractRemCents({
      project_id: 'c2',
      days: 1,
      tjm_cents: 100_000,
      referral_pct: 10,
      user_id: USER_P,
    });
    const c3 = externalContractRemCents({
      project_id: 'c3',
      days: 1,
      tjm_cents: 80_000,
      referral_pct: 0,
      user_id: USER_P,
    });
    expect(c1.rem_cents).toBe(270_000); // 500*6*0.9
    expect(c2.rem_cents).toBe(90_000);
    expect(c3.rem_cents).toBe(80_000);

    const productNet = 800_000; // 8000€ octobot monthly in example
    const lines = computeExternalTjmMonth({
      business_days: 22,
      product_net_cents: productNet,
      default_max_fraction: 1,
      partners: [
        {
          user_id: USER_P,
          contract_days: 8,
          contract_rem_cents: c1.rem_cents + c2.rem_cents + c3.rem_cents,
          referral_income_cents: 100_000, // 0.1 * 1 * 1000 from being? example ref on C2 for P is income to referrer of C2 — P has ref on C2 as cut not income; example: P ref=10%(C2) means P is referrer earning on C2... actually "ref=10%(C2)" under P means referral fee on C2. Looking at example: P gets +0.1x1x1000 as referral income. So P is referrer of C2.
          vacation_days: 0,
          product_logged_days: 0,
        },
        {
          user_id: USER_G,
          contract_days: 10,
          contract_rem_cents: 900_000, // 10*1000*0.9
          referral_income_cents: 30_000, // 0.1*6*500
          vacation_days: 0,
          product_logged_days: 0,
        },
      ],
    });
    const by = sumRemLinesByUser(lines);
    // residual days P=14, G=12 → weights 14/26 and 12/26 of 8000
    expect(by[USER_P]).toBe(
      270_000 + 90_000 + 80_000 + 100_000 + Math.round((14 / 26) * productNet),
    );
    expect(by[USER_G]).toBe(900_000 + 30_000 + Math.round((12 / 26) * productNet));
  });

  it('C2 all days on contracts → residual 0 weight from residual only', () => {
    expect(productPoolDaysForExternal(22, 22, 0, 0)).toBe(0);
  });

  it('C3 no contract days → full business days', () => {
    expect(productPoolDaysForExternal(22, 0, 0, 0)).toBe(22);
  });

  it('C5 partial day via minutes', () => {
    const rem = externalContractRemCents({
      project_id: 'c',
      days: 0.5,
      tjm_cents: 100_000,
      referral_pct: 0,
      user_id: USER_G,
    });
    expect(rem.rem_cents).toBe(50_000);
  });
});

describe('jungle queue', () => {
  it('D1 enqueue', () => {
    expect(enqueueJungleCents(3, 50_000)).toBe(150_000);
    expect(enqueueJungleCents(0, 50_000)).toBe(0);
    expect(enqueueJungleCents(3, 0)).toBe(0);
  });

  it('D2–D4 FIFO dequeue partial and excess', () => {
    const entries = [
      {
        id: '1',
        user_id: USER_G,
        project_id: 'j',
        queued_cents: 100_000,
        remaining_cents: 100_000,
        seq: 1,
      },
      {
        id: '2',
        user_id: USER_G,
        project_id: 'j',
        queued_cents: 50_000,
        remaining_cents: 50_000,
        seq: 2,
      },
    ];
    const partial = dequeueJungleFifo(entries, 120_000);
    expect(partial.remaining_by_id['1']).toBe(0);
    expect(partial.remaining_by_id['2']).toBe(30_000);
    expect(partial.lines.reduce((s, l) => s + l.amount_cents, 0)).toBe(120_000);
    expect(partial.excess_revenue_cents).toBe(0);

    const over = dequeueJungleFifo(entries, 200_000);
    expect(over.excess_revenue_cents).toBe(50_000);
  });

  it('D5 multi-user independent FIFO sharing pool', () => {
    const entries = [
      {
        id: 'g1',
        user_id: USER_G,
        project_id: 'j',
        queued_cents: 100_000,
        remaining_cents: 100_000,
        seq: 1,
      },
      {
        id: 'p1',
        user_id: USER_P,
        project_id: 'j',
        queued_cents: 100_000,
        remaining_cents: 100_000,
        seq: 1,
      },
    ];
    const r = dequeueJungleFifo(entries, 150_000);
    expect(r.lines.reduce((s, l) => s + l.amount_cents, 0)).toBe(150_000);
  });

  it('D7 no revenue → empty dequeue', () => {
    const r = dequeueJungleFifo(
      [
        {
          id: '1',
          user_id: USER_G,
          project_id: 'j',
          queued_cents: 10,
          remaining_cents: 10,
          seq: 1,
        },
      ],
      0,
    );
    expect(r.lines).toHaveLength(0);
  });
});

describe('leave', () => {
  it('E1–E2 only vacation counts', () => {
    expect(vacationDaysFromTimeOff('vacation', null, 8)).toBe(1);
    expect(vacationDaysFromTimeOff('sick', null, 8)).toBe(0);
    expect(vacationDaysFromTimeOff('personal', null, 8)).toBe(0);
  });

  it('E3 partial day', () => {
    expect(vacationDaysFromTimeOff('vacation', 240, 8)).toBe(0.5);
  });

  it('E4 leave increases product pool weight', () => {
    const withLeave = productPoolDaysForExternal(22, 10, 2, 0);
    const without = productPoolDaysForExternal(22, 10, 0, 0);
    expect(withLeave).toBe(without + 2);
  });
});

describe('company fee reserve G', () => {
  it('G1–G2 staffing fee 0 → no fee line needed from product', () => {
    expect(companyFeeCents(100_000, 0)).toBe(0);
  });

  it('G3 external TJM rem unchanged by fee pct', () => {
    const a = externalContractRemCents({
      project_id: 'c',
      days: 1,
      tjm_cents: 100_000,
      referral_pct: 10,
      user_id: USER_G,
    });
    // fee does not enter externalContractRemCents
    expect(a.rem_cents).toBe(90_000);
  });
});

describe('staffing H2', () => {
  it('staffingTjmRemCents matches computeEarnedCents with no referral', () => {
    expect(staffingTjmRemCents(420, 7, 50_000)).toBe(
      computeEarnedCents(420, 7, 50_000),
    );
  });

  it('applies referral carve-out when referral pct > 0', () => {
    const gross = computeEarnedCents(420, 7, 50_000);
    expect(staffingTjmRemCents(420, 7, 50_000, 10)).toBe(gross - Math.round(gross * 0.1));
  });
});

describe('aggregates', () => {
  it('sum and visible and take-home', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
      ],
      default_max_fraction: 1,
    });
    expect(visibleRemLines(r.lines).every((l) => l.amount_cents !== 0)).toBe(true);
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBe(308_750);
    expect(sumRemLinesByBucket(r.lines).company_fee).toBe(32_500);
  });
});

describe('splitCentsByShares', () => {
  it('preserves total', () => {
    const s = splitCentsByShares(100, [
      { user_id: 'a', share: 1 / 3 },
      { user_id: 'b', share: 1 / 3 },
      { user_id: 'c', share: 1 / 3 },
    ]);
    expect(s.reduce((a, x) => a + x.amount_cents, 0)).toBe(100);
  });
});
