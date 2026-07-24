/**
 * Snapshot parity fixtures: SDK preview vs documented SQL case IDs.
 * No live DB — asserts SDK output matches migration comment expectations.
 */
import { describe, expect, it } from 'vitest';
import { computeProductPoolRem, computeProductServiceRem } from './rem.lib';
import { PRODUCT_POOL_BASE, PRODUCT_SERVICE_BASE, USER_G, USER_P } from './rem.fixtures';
import { partnerTakeHomeCents } from './rem.lib';

describe('SQL/SDK parity snapshots (K)', () => {
  it('A1 matches migration comment', () => {
    const r = computeProductPoolRem({
      ...PRODUCT_POOL_BASE,
      partners: [
        { user_id: USER_G, time_weight: 1 },
        { user_id: USER_P, time_weight: 1 },
      ],
      default_max_fraction: 0.75,
    });
    expect(r.company_fee_cents).toBe(32_500);
    expect(r.net_cents).toBe(617_500);
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBe(308_750);
  });

  it('B1 matches migration comment', () => {
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
    expect(partnerTakeHomeCents(r.lines, USER_G)).toBe(456_000);
  });
});
