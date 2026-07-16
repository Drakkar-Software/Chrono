import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { CHRONO_PRO_PRODUCT_IDS, RC_ENTITLEMENT_ID, type ChronoProProductId, type PurchaseOutcome, type Tier } from './revenuecat-constants';
import { setIsProLive } from './revenuecat-live-state';

let configured = false;
let currentCompanyAppUserId: string | null = null;

function resolveApiKey(): string | null {
  if (__DEV__) {
    const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
    if (testKey) return testKey;
  }
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  return key || null;
}

/**
 * Applies live RC entitlement state, but only if it's still for the currently
 * active company — guards against a stale async result landing after a fast
 * company switch.
 */
function applyCustomerInfo(info: CustomerInfo): void {
  if (info.originalAppUserId !== currentCompanyAppUserId) return;
  setIsProLive(info.entitlements.active[RC_ENTITLEMENT_ID] !== undefined);
}

/**
 * Configures (once) or re-identifies (`logIn`) RevenueCat under the active
 * company's app-user-id, so the Chrono Pro entitlement is shared by every
 * member of that company rather than tied to the purchasing device's user.
 */
export function configureRevenueCat(companyAppUserId: string): void {
  currentCompanyAppUserId = companyAppUserId;
  if (!configured) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      if (__DEV__) console.warn('[revenuecat] no API key configured — skipping Purchases.configure');
      return;
    }
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      Purchases.configure({ apiKey, appUserID: companyAppUserId });
      configured = true;
    } catch {
      return;
    }
    Purchases.getCustomerInfo().then(applyCustomerInfo).catch(() => {});
    return;
  }
  Purchases.logIn(companyAppUserId)
    .then(({ customerInfo }) => applyCustomerInfo(customerInfo))
    .catch((e) => {
      // A failed re-identify (e.g. transient offline right at a company
      // switch) would otherwise leave `isProLive` stuck at the `false` this
      // function's caller set pre-emptively, even if this device does hold
      // the new company's entitlement. One retry covers the common transient
      // case; a still-failing device falls back to the synced
      // `company_subscriptions` row (see `useChronoPro`) until it reconnects.
      if (__DEV__) console.warn('[revenuecat] logIn failed, retrying once', e);
      Purchases.logIn(companyAppUserId)
        .then(({ customerInfo }) => applyCustomerInfo(customerInfo))
        .catch((e2) => {
          if (__DEV__) console.warn('[revenuecat] logIn retry failed', e2);
        });
    });
}

export function subscribeCustomerInfo(): () => void {
  Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
  return () => Purchases.removeCustomerInfoUpdateListener(applyCustomerInfo);
}

/** The Chrono Pro seat-tier packages in the current offering, ordered by seat capacity. */
export async function getTierPackages(): Promise<Tier[]> {
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return packages
    .filter((pkg): pkg is PurchasesPackage & { product: { identifier: ChronoProProductId } } =>
      (CHRONO_PRO_PRODUCT_IDS as readonly string[]).includes(pkg.product.identifier),
    )
    .map((pkg) => ({ productId: pkg.product.identifier, priceString: pkg.product.priceString, raw: pkg }));
}

export async function purchaseTier(tier: Tier): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(tier.raw as PurchasesPackage);
    applyCustomerInfo(customerInfo);
    return { kind: 'purchased' };
  } catch (e) {
    const err = e as { userCancelled?: boolean } & Error;
    if (err?.userCancelled) return { kind: 'cancelled' };
    return { kind: 'failed', error: err };
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    applyCustomerInfo(customerInfo);
    return true;
  } catch {
    return false;
  }
}
