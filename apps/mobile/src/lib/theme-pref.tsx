import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ColorScheme } from '@chrono/ui';

/** User's theme choice — 'system' follows the OS scheme. */
export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'chrono.themePref';

interface ThemePrefValue {
  pref: ThemePref;
  /** Forced scheme for `@chrono/ui`'s ThemeProvider; undefined = follow OS. */
  scheme: ColorScheme | undefined;
  setPref: (pref: ThemePref) => void;
}

const ThemePrefContext = createContext<ThemePrefValue>({
  pref: 'system',
  scheme: undefined,
  setPref: () => {},
});

/** Holds the persisted light/dark/system choice and feeds it to the UI theme. */
export function ThemePrefProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const setPref = (next: ThemePref) => {
    setPrefState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const scheme = pref === 'system' ? undefined : pref;

  return (
    <ThemePrefContext.Provider value={{ pref, scheme, setPref }}>{children}</ThemePrefContext.Provider>
  );
}

export const useThemePref = () => useContext(ThemePrefContext);
