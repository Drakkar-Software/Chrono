import { Platform } from 'react-native';
import type { Database } from '@chrono/sdk/schema';
import { createSupabaseStores } from '@drakkar.software/anchor';
import { useAuth } from '@drakkar.software/anchor/hooks';
import { globalSupabaseClient } from './supabase';
import { getAdapters } from './adapters';

// Real browser environment (not SSR where Platform.OS === 'web' but no window).
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const PROJECT_SELECT = '*';
const TIME_ENTRY_SELECT = '*, project:projects(name,color,hours_per_day)';
const INVOICE_SELECT = '*, project:projects(name)';

const TABLES = [
  'profiles',
  'companies',
  'company_members',
  'projects',
  'project_members',
  'revenue_sources',
  'revenue_entries',
  'project_referrals',
  'referral_earnings',
  'time_entries',
  'invoices',
  'notifications',
  'device_tokens',
  'company_invites',
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
