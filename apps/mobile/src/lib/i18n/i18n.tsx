import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import type { Locale } from './types';
import { catalogs } from './catalogs';

export type LanguagePref = 'system' | Locale;

const STORAGE_KEY = 'chrono.language';

/** The device's preferred language, mapped to a supported locale (default en). */
function deviceLocale(): Locale {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

function resolveLocale(pref: LanguagePref): Locale {
  return pref === 'system' ? deviceLocale() : pref;
}

/** Interpolate `{name}` placeholders in a template. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export type TFn = (key: string, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  pref: LanguagePref;
  setPref: (pref: LanguagePref) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LanguagePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'en' || v === 'fr' || v === 'system') setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const setPref = useCallback((next: LanguagePref) => {
    setPrefState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const locale = resolveLocale(pref);

  const t = useCallback<TFn>(
    (key, params) => {
      const table = catalogs[locale];
      const template = table[key] ?? catalogs.en[key] ?? key;
      return interpolate(template, params);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, pref, setPref, t }), [locale, pref, setPref, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback (e.g. SSR before the provider mounts): English, identity-ish t.
    return {
      locale: 'en',
      pref: 'system',
      setPref: () => {},
      t: (key, params) => interpolate(catalogs.en[key] ?? key, params),
    };
  }
  return ctx;
}

/** Translation function hook: `const t = useT(); t('common.save')`. */
export function useT(): TFn {
  return useI18n().t;
}

/** Language preference controls (for the settings switcher). */
export function useLanguage(): { pref: LanguagePref; locale: Locale; setPref: (p: LanguagePref) => void } {
  const { pref, locale, setPref } = useI18n();
  return { pref, locale, setPref };
}
