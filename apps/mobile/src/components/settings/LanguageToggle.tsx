import { Segmented } from '@chrono/ui';

import { useLanguage, useT, type LanguagePref } from '@/lib/i18n';

/** Language switcher bound to the persisted language preference. */
export function LanguageToggle() {
  const t = useT();
  const { pref, setPref } = useLanguage();
  const options: { label: string; value: LanguagePref }[] = [
    { label: t('settings.system'), value: 'system' },
    { label: 'English', value: 'en' },
    { label: 'Français', value: 'fr' },
  ];
  return <Segmented options={options} value={pref} onValueChange={(v) => setPref(v as LanguagePref)} />;
}
