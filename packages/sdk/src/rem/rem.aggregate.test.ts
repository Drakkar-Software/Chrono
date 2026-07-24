import { describe, expect, it } from 'vitest';
import { remLinesFingerprint, sumRemLinesByUser } from './rem.lib';
import { computeProductPoolRem, computeProductServiceRem } from './rem.lib';
import { PRODUCT_POOL_BASE, USER_G, USER_P } from './rem.fixtures';
import type { RemLinePreview } from './rem.entity';

describe('rem aggregates', () => {
  it('idempotent fingerprint for same product pool inputs', () => {
    const input = {
      ...PRODUCT_POOL_BASE,
      partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
      ],
      default_max_fraction: 0.75,
    };
    const a = computeProductPoolRem(input);
    const b = computeProductPoolRem(input);
    expect(remLinesFingerprint(a.lines)).toBe(remLinesFingerprint(b.lines));
  });

  it('mixed-policy lines do not double-count when fingerprints differ by project', () => {
    const pool = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: [{ user_id: USER_G, time_weight: 1 }],
      default_max_fraction: 1,
    });
    const svc = computeProductServiceRem({
      revenue_cents: 100_000,
      company_fee_pct: 0,
      license_pct: 0,
      referral_pct: 0,
      referrer_user_ids: [],
      time_partners: [{ user_id: USER_G, time_weight: 1 }],
      license_partner_ids: [USER_G],
      project_id: 'svc-1',
    });
    const merged: RemLinePreview[] = [...pool.lines, ...svc.lines];
    expect(sumRemLinesByUser(merged)[USER_G]).toBe(
      (sumRemLinesByUser(pool.lines)[USER_G] ?? 0) +
        (sumRemLinesByUser(svc.lines)[USER_G] ?? 0),
    );
  });
});
