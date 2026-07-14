import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { globalSupabaseClient } from '@/lib/supabase';
import { useAppAuth } from '@/lib/supabase-stores';
import { fetchMyCompanies } from '@chrono/sdk';
import type { AppRole, CompanyMembership } from '@chrono/sdk';

const STORAGE_KEY = 'chrono.activeCompanyId';

export interface ActiveCompanyValue {
  /** Active company id, or null while loading / when the user has none. */
  companyId: string | null;
  /** The active company membership (company columns + the caller's role). */
  company: CompanyMembership | null;
  /** All companies the user belongs to. */
  companies: CompanyMembership[];
  /** The caller's role in the active company. */
  role: AppRole | null;
  /** True while the company list is being loaded. */
  isLoading: boolean;
  /** True when the last load failed — distinguishes "no companies" from an error. */
  loadFailed: boolean;
  /** Switch the active company (persisted to AsyncStorage). */
  setCompanyId: (id: string) => void;
  /** Re-fetch the user's companies (e.g. right after creating one). */
  refresh: () => Promise<void>;
}

const ActiveCompanyContext = createContext<ActiveCompanyValue>({
  companyId: null,
  company: null,
  companies: [],
  role: null,
  isLoading: true,
  loadFailed: false,
  setCompanyId: () => {},
  refresh: async () => {},
});

/**
 * Loads the user's companies once authenticated, restores the last-active one
 * from AsyncStorage (or falls back to the first), and exposes a switcher. All
 * SSR / signed-out states degrade to empty.
 */
export function ActiveCompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAppAuth();
  const userId = user?.id;

  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // The persisted selection is restored only once (first successful load) and
  // never over a company the user just explicitly picked — otherwise a refresh
  // (e.g. right after creating a company) would snap back to the stored id.
  const hasRestoredRef = useRef(false);
  const explicitSelectionRef = useRef(false);

  const load = useCallback(async () => {
    if (!userId) {
      setCompanies([]);
      setCompanyIdState(null);
      setLoadFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    let list: CompanyMembership[];
    try {
      list = await fetchMyCompanies(globalSupabaseClient, userId);
    } catch {
      // Surface the failure instead of masquerading as an empty account;
      // keep any previously loaded companies/selection intact.
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    setCompanies(list);

    // Resolve the persisted selection at most once, before clearing loading.
    let restored: string | null = null;
    if (!hasRestoredRef.current && !explicitSelectionRef.current) {
      const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (stored && list.some((c) => c.id === stored)) restored = stored;
    }
    hasRestoredRef.current = true;

    setCompanyIdState((current) => {
      // Keep a still-valid selection (covers a just-created/just-picked company).
      if (current && list.some((c) => c.id === current)) return current;
      // First load: prefer the persisted selection, then fall back to the first.
      return restored ?? list[0]?.id ?? null;
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // Load the user's companies on mount / when the user changes. `load` sets
    // loading state synchronously as it kicks off the async fetch — a legitimate
    // data-loading effect, not a render-driven cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async company load on mount
    void load();
  }, [load]);

  const company = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  const setCompanyId = useCallback((id: string) => {
    explicitSelectionRef.current = true;
    setCompanyIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const value = useMemo<ActiveCompanyValue>(
    () => ({
      companyId,
      company,
      companies,
      role: company?.role ?? null,
      isLoading,
      loadFailed,
      setCompanyId,
      refresh: load,
    }),
    [companyId, company, companies, isLoading, loadFailed, setCompanyId, load],
  );

  return (
    <ActiveCompanyContext.Provider value={value}>
      {children}
    </ActiveCompanyContext.Provider>
  );
}

export function useActiveCompany(): ActiveCompanyValue {
  return useContext(ActiveCompanyContext);
}
