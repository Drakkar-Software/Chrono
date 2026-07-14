import { Segmented } from '@chrono/ui';

import { useThemePref, type ThemePref } from '@/lib/theme-pref';

const OPTIONS: { label: string; value: ThemePref }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/** Appearance switcher bound to the persisted theme preference. */
export function ThemeToggle() {
  const { pref, setPref } = useThemePref();
  return (
    <Segmented
      options={OPTIONS}
      value={pref}
      onValueChange={(v) => setPref(v as ThemePref)}
    />
  );
}
