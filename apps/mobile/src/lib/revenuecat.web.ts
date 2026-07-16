import { Purchases, LogLevel, type CustomerInfo, type Package } from '@revenuecat/purchases-js';

import { CHRONO_PRO_PRODUCT_IDS, RC_ENTITLEMENT_ID, type ChronoProProductId, type PurchaseOutcome, type Tier } from './revenuecat-constants';
import { setIsProLive } from './revenuecat-live-state';

let purchases: Purchases | null = null;
let currentCompanyAppUserId: string | null = null;

function resolveApiKey(): string | null {
  if (__DEV__) {
    const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
    if (testKey) return testKey;
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY || null;
}

function applyCustomerInfo(info: CustomerInfo): void {
  if (info.originalAppUserId !== currentCompanyAppUserId) return;
  setIsProLive(info.entitlements.active[RC_ENTITLEMENT_ID] !== undefined);
}

export function configureRevenueCat(companyAppUserId: string): void {
  currentCompanyAppUserId = companyAppUserId;
  if (!purchases) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      if (__DEV__) console.warn('[revenuecat] no web API key configured — skipping Purchases.configure');
      return;
    }
    try {
      Purchases.setLogLevel(__DEV__ ? LogLevel.Debug : LogLevel.Info);
      purchases = Purchases.configure(apiKey, companyAppUserId);
    } catch {
      return;
    }
    purchases.getCustomerInfo().then(applyCustomerInfo).catch(() => {});
    return;
  }
  purchases.changeUser(companyAppUserId).then(applyCustomerInfo).catch(() => {});
}

/** No live-update listener on web — the customer-info re-fetch above (on configure/changeUser) is the sync point. */
export function subscribeCustomerInfo(): () => void {
  return () => {};
}

export async function getTierPackages(): Promise<Tier[]> {
  if (!purchases) return [];
  const offerings = await purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return packages
    .filter((pkg): pkg is Package & { rcBillingProduct: { identifier: ChronoProProductId } } =>
      (CHRONO_PRO_PRODUCT_IDS as readonly string[]).includes(pkg.rcBillingProduct.identifier),
    )
    .map((pkg) => ({
      productId: pkg.rcBillingProduct.identifier,
      priceString: pkg.rcBillingProduct.currentPrice?.formattedPrice ?? '',
      raw: pkg,
    }));
}

export async function purchaseTier(tier: Tier): Promise<PurchaseOutcome> {
  if (!purchases) return { kind: 'failed', error: new Error('RevenueCat not configured') };
  try {
    const { customerInfo } = await purchases.purchase({ rcPackage: tier.raw as Package });
    applyCustomerInfo(customerInfo);
    return { kind: 'purchased' };
  } catch (e) {
    const err = e as { errorCode?: string } & Error;
    if (err?.errorCode === 'UserCancelledError') return { kind: 'cancelled' };
    return { kind: 'failed', error: err };
  }
}

/** Web has no receipt to restore — just re-syncs the live customer-info flag. */
export async function restorePurchases(): Promise<boolean> {
  if (!purchases) return false;
  try {
    const customerInfo = await purchases.getCustomerInfo();
    applyCustomerInfo(customerInfo);
    return true;
  } catch {
    return false;
  }
}
