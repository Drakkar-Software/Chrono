import { describe, expect, it } from 'vitest';
import {
  companyPoolCostsCents,
  estimateCompanyFeeCents,
  estimateLicenseRevenueCents,
  feeVsCostsTrend,
  licenseByProject,
  resolveCompanyFeeTotal,
  resolveLicenseTotal,
} from './company-rem-reports';

const projects = [
  { id: 'p1', name: 'Svc', rem_policy: 'product_service' as const },
  { id: 'p2', name: 'Pool', rem_policy: 'product_pool' as const },
  { id: 'p3', name: 'Staff', rem_policy: 'staffing' as const },
];

describe('estimateCompanyFeeCents', () => {
  it('fees only paid revenue on pool/service projects', () => {
    const fee = estimateCompanyFeeCents(
      [
        { project_id: 'p1', period_month: '2026-07-01', amount_cents: 100_000, paid_at: '2026-07-10' },
        { project_id: 'p2', period_month: '2026-07-01', amount_cents: 100_000, paid_at: '2026-07-10' },
        { project_id: 'p3', period_month: '2026-07-01', amount_cents: 100_000, paid_at: '2026-07-10' },
        { project_id: 'p1', period_month: '2026-07-01', amount_cents: 50_000, paid_at: null },
      ],
      projects,
      5,
      '2026-07',
    );
    // 200_000 × 5% = 10_000 (staffing + unpaid excluded)
    expect(fee).toBe(10_000);
  });
});

describe('estimateLicenseRevenueCents', () => {
  it('applies license on after-fee product_service revenue only', () => {
    const lic = estimateLicenseRevenueCents(
      [
        { project_id: 'p1', period_month: '2026-07-01', amount_cents: 100_000, paid_at: 'x' },
        { project_id: 'p2', period_month: '2026-07-01', amount_cents: 100_000, paid_at: 'x' },
      ],
      projects,
      5,
      30,
      '2026-07',
    );
    // fee 5_000, after 95_000 × 30% = 28_500
    expect(lic).toBe(28_500);
  });
});

describe('companyPoolCostsCents', () => {
  it('sums one month of deductible pool costs', () => {
    const costs = [
      {
        kind: 'one_off' as const,
        amount_cents: 40_000,
        active: true,
        paid_at: '2026-07-01',
        auto_deduct: false,
        period_month: '2026-07-01',
        starts_on: null,
        ends_on: null,
      },
    ];
    expect(companyPoolCostsCents(costs, '2026-07')).toBe(40_000);
  });
});

describe('feeVsCostsTrend', () => {
  it('prefers ledger fee over estimate', () => {
    const points = feeVsCostsTrend({
      today: '2026-07-15',
      count: 1,
      costs: [],
      feeReserve: [{ period_month: '2026-07-01', amount_cents: 12_345 }],
      revenueEntries: [],
      projects,
      companyFeePct: 5,
    });
    expect(points[0]).toMatchObject({ month: '2026-07', feeCents: 12_345, costsCents: 0 });
  });
});

describe('licenseByProject', () => {
  it('breaks down per product_service project', () => {
    const rows = licenseByProject(
      [{ project_id: 'p1', period_month: '2026-07-01', amount_cents: 100_000, paid_at: 'x' }],
      projects,
      5,
      30,
      '2026-07',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.licenseCents).toBe(28_500);
  });
});

describe('resolve totals', () => {
  it('prefers rem/ledger when provided', () => {
    expect(resolveLicenseTotal({ remLicenseCents: 1, estimatedCents: 99 })).toBe(1);
    expect(resolveLicenseTotal({ remLicenseCents: null, estimatedCents: 99 })).toBe(99);
    expect(resolveCompanyFeeTotal({ reserveCents: 2, estimatedCents: 99 })).toBe(2);
  });
});
