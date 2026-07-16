/**
 * Chrono Pro — RevenueCat contract. Kept in a neutral (non-`revenuecat*`)
 * filename so Metro's platform-extension resolution doesn't try to route it
 * through `revenuecat.web.ts` (mirrors the `revenuecat.ts` / `revenuecat.web.ts`
 * split below).
 *
 * The store product ids and their plan/seat-limit mapping are also mirrored in
 * `backend/supabase/functions/revenuecat-webhook` (a separate Deno runtime that
 * can't import this file) and in `@chrono/sdk`'s `subscription.lib.ts`
 * (`PRODUCT_PLAN_MAP`) — keep all three in sync when a plan or product id
 * changes.
 */

export const RC_ENTITLEMENT_ID = 'Chrono Pro';

export const CHRONO_PRO_PRODUCT_IDS = ['chrono_pro_solo', 'chrono_pro_team', 'chrono_pro_scale'] as const;
export type ChronoProProductId = (typeof CHRONO_PRO_PRODUCT_IDS)[number];

/** A company's RevenueCat appUserID — the identity purchases are attached to, so the entitlement propagates to every member. */
export function companyAppUserId(companyId: string): string {
  return `company_${companyId}`;
}

export type PurchaseOutcome =
  | { kind: 'purchased' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: Error };

/**
 * A purchasable Chrono Pro tier, normalized from the platform-specific
 * RevenueCat package shape (native `PurchasesPackage` vs. web `Package`) so
 * the paywall UI stays platform-agnostic. `raw` is passed back into
 * `purchaseTier` unchanged — only `revenuecat.ts` / `revenuecat.web.ts` know
 * what's inside it.
 */
export interface Tier {
  productId: ChronoProProductId;
  priceString: string;
  raw: unknown;
}
