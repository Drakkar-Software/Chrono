import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { canManage, unreadCount } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useAppAuth } from '@/lib/supabase-stores';
import { useNotifications } from '@/lib/hooks/use-notifications';

const { Label, Icon, Badge } = NativeTabs.Trigger;

/**
 * Native (iOS/Android) bottom tabs backed by the platform tab bar. The
 * `reports` trigger is only rendered for managers/admins. Mirrors the web
 * `<Tabs>` layout in `_layout.tsx`.
 */
export default function NativeTabsLayout() {
  const t = useT();
  const { role } = useActiveCompany();
  const { user } = useAppAuth();
  const { data: notifications } = useNotifications(user?.id);
  const unread = unreadCount(notifications ?? []);
  const showReports = canManage(role);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home/index">
        <Label>{t('tabs.nav.home')}</Label>
        <Icon sf="house" />
        {unread > 0 ? <Badge>{unread > 99 ? '99+' : String(unread)}</Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projects/index">
        <Label>{t('tabs.nav.projects')}</Label>
        <Icon sf="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="invoices/index">
        <Label>{t('tabs.nav.invoices')}</Label>
        <Icon sf="doc.text" />
      </NativeTabs.Trigger>
      {showReports ? (
        <NativeTabs.Trigger name="reports/index">
          <Label>{t('tabs.nav.reports')}</Label>
          <Icon sf="chart.bar" />
        </NativeTabs.Trigger>
      ) : null}
      <NativeTabs.Trigger name="settings/index">
        <Label>{t('tabs.nav.settings')}</Label>
        <Icon sf="gearshape" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
