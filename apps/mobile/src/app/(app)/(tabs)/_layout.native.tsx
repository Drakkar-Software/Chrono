import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { canManage } from '@chrono/sdk';
import { useActiveCompany } from '@/lib/active-company-context';

/**
 * Native (iOS/Android) bottom tabs backed by the platform tab bar. The
 * `reports` trigger is only rendered for managers/admins. Mirrors the web
 * `<Tabs>` layout in `_layout.tsx`.
 */
export default function NativeTabsLayout() {
  const { role } = useActiveCompany();
  const showReports = canManage(role);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="today/index">
        <Label>Log</Label>
        <Icon sf="clock" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projects/index">
        <Label>Projects</Label>
        <Icon sf="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="invoices/index">
        <Label>Invoices</Label>
        <Icon sf="doc.text" />
      </NativeTabs.Trigger>
      {showReports ? (
        <NativeTabs.Trigger name="reports/index">
          <Label>Reports</Label>
          <Icon sf="chart.bar" />
        </NativeTabs.Trigger>
      ) : null}
      <NativeTabs.Trigger name="settings/index">
        <Label>Settings</Label>
        <Icon sf="gearshape" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
