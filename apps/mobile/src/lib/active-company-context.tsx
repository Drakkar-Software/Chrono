import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const load = useCallback(async () => {
    if (!userId) {
      setCompanies([]);
      setCompanyIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchMyCompanies(globalSupabaseClient, userId).catch(
      () => [] as CompanyMembership[],
    );
    setCompanies(list);
    setCompanyIdState((current) => {
      if (current && list.some((c) => c.id === current)) return current;
      return list[0]?.id ?? null;
    });
    setLoading(false);
    // Prefer a persisted selection when there's no current pick yet.
    const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (stored && list.some((c) => c.id === stored)) {
      setCompanyIdState(stored);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const company = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  const setCompanyId = useCallback((id: string) => {
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
      setCompanyId,
      refresh: load,
    }),
    [companyId, company, companies, isLoading, setCompanyId, load],
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
