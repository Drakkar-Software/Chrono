import { Platform } from 'react-native';
import type { Database } from '@chrono/sdk/schema';
import { INVOICE_SELECT, PROJECT_SELECT, TIME_ENTRY_SELECT } from '@chrono/sdk';
import { createSupabaseStores } from '@drakkar.software/anchor';
import { useAuth } from '@drakkar.software/anchor/hooks';
import { globalSupabaseClient } from './supabase';
import { getAdapters } from './adapters';

// Real browser environment (not SSR where Platform.OS === 'web' but no window).
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

// Store defaultSelects are imported from the SDK query modules (the single source
// of truth) so the store's hydration shape can never drift from what the fetch*
// functions return — a past bug was the store's INVOICE_SELECT omitting the
// `freelancer:profiles(full_name)` embed the SDK select declares.

const TABLES = [
  'profiles',
  'profile_billing',
  'companies',
  'company_members',
  'projects',
  'project_members',
  'revenue_sources',
  'revenue_entries',
  'project_fixed_costs',
  'project_expenses',
  'project_referrals',
  'referral_earnings',
  'time_entries',
  'invoices',
  'notifications',
  'company_invites',
  'invoice_payments',
  'audit_log',
  // NOTE: device_tokens is intentionally NOT registered — push token I/O goes
  // straight through the SDK (register/unregisterDeviceToken), never the store,
  // so a store here would only add a dead subscription + persistence slot.
] as const;

// Lazy singleton — avoids creating stores during SSR where the Supabase client can't run.
let _stores: ReturnType<typeof createSupabaseStores<Database>> | null = null;

function getStores() {
  if (!_stores) {
    const adapters = getAdapters();
    _stores = createSupabaseStores<Database>({
      supabase: globalSupabaseClient,
      tables: [...TABLES],
      persistence: adapters.persistence,
      network: adapters.network,
      fetchRemoteOnBoot: false,
      authGate: { refetchOnSignIn: false }, // fetch on-demand via the use-* hooks
      tableOptions: {
        profiles: { primaryKey: 'user_id' },
        profile_billing: { primaryKey: 'user_id' },
        projects: { defaultSelect: PROJECT_SELECT },
        time_entries: { defaultSelect: TIME_ENTRY_SELECT },
        invoices: { defaultSelect: INVOICE_SELECT },
        // company_members, project_members, revenue_entries, project_referrals,
        // referral_earnings all use the default surrogate 'id' PK.
      },
    });
  }
  return _stores;
}

// Proxy that lazily initializes the stores on first property access.
export const stores = new Proxy({} as ReturnType<typeof createSupabaseStores<Database>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getStores(), prop, receiver);
  },
});

// SSR-safe auth hook.
export function useAppAuth() {
  // `isSSR` is a module-level constant derived from the runtime environment, so
  // this branch is taken identically on every render of a given process — the
  // hook order never actually changes. We cannot call `useAuth(stores.auth)`
  // during SSR because accessing `stores.auth` would eagerly create the Supabase
  // stores, which can't run without a browser/native runtime. Hence the guarded
  // early return with a scoped disable rather than an unconditional hook call.
  if (isSSR) {
    return {
      session: null,
      user: null,
      isLoading: true,
      error: null,
      signIn: async () => {},
      signUp: async () => {},
      signOut: async () => {},
      signInWithOAuth: async () => {},
      refreshSession: async () => {},
    } as ReturnType<typeof useAuth>;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see comment above: `isSSR` is a stable module constant, so hook order is invariant per process.
  return useAuth(stores.auth);
}
