import { useSyncExternalStore } from 'react';

/**
 * Live (this-device) read of the Chrono Pro entitlement, set by
 * `applyCustomerInfo` in `revenuecat.ts` / `revenuecat.web.ts`. A plain
 * module-level subscribable — the app has no store library (no zustand/redux),
 * so this mirrors the existing `ActiveCompanyProvider`-style "small piece of
 * shared state" idiom rather than adding one.
 *
 * This is a fast/optimistic signal only. The durable, offline-safe read is
 * `use-subscription.ts`'s `company_subscriptions` row (synced by the
 * RevenueCat webhook) — see `useIsChronoPro`, which ORs the two.
 */
let isProLive = false;
const listeners = new Set<() => void>();

export function setIsProLive(value: boolean): void {
  if (value === isProLive) return;
  isProLive = value;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return isProLive;
}

export function useIsProLive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
