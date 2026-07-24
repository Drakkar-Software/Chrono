/**
 * Golden fixtures for unified rem (amounts in cents unless noted).
 * Case IDs match plan Testing section A1–C1 etc.
 */

/** A1–A3 product pool base: (4000 + 3000 − 500) × 0.95 = 6175€ */
export const PRODUCT_POOL_BASE = {
  direct_sales_cents: 400_000,
  maintenance_cents: 300_000,
  costs_cents: 50_000,
  company_fee_pct: 5,
  /** fee on (gross − costs): round(650000 × 5%) = 32500; net = 617500 */
  expected_fee_cents: 32_500,
  expected_net_cents: 617_500,
} as const;

export const USER_G = 'user-g';
export const USER_P = 'user-p';
export const USER_X = 'user-x';

/** Product service base: R = 9600€, fee 5%, license 30% */
export const PRODUCT_SERVICE_BASE = {
  revenue_cents: 960_000,
  company_fee_pct: 5,
  license_pct: 30,
  expected_fee_cents: 48_000,
  expected_after_fee_cents: 912_000,
  expected_license_cents: 273_600, // 30% of 912000
} as const;
