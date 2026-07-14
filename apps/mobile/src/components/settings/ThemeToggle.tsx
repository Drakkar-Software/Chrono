import { Segmented } from '@chrono/ui';

import { useT } from '@/lib/i18n';
import { useThemePref, type ThemePref } from '@/lib/theme-pref';

/** Appearance switcher bound to the persisted theme preference. */
export function ThemeToggle() {
  const t = useT();
  const { pref, setPref } = useThemePref();
  const options: { label: string; value: ThemePref }[] = [
    { label: t('compb.theme.system'), value: 'system' },
    { label: t('compb.theme.light'), value: 'light' },
    { label: t('compb.theme.dark'), value: 'dark' },
  ];
  return (
    <Segmented
      options={options}
      value={pref}
      onValueChange={(v) => setPref(v as ThemePref)}
    />
  );
}
