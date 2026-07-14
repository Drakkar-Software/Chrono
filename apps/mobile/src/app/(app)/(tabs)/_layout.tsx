import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive, useTheme } from '@chrono/ui';
import { canManage, unreadCount } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useAppAuth } from '@/lib/supabase-stores';
import { useNotifications } from '@/lib/hooks/use-notifications';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const icon = (name: IoniconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

/** Web tab bar. `reports` is manager-only (`href: null` hides it otherwise). */
export default function TabsLayout() {
  const t = useT();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const { role } = useActiveCompany();
  const { user } = useAppAuth();
  const { data: notifications } = useNotifications(user?.id);
  const unread = unreadCount(notifications ?? []);
  const showReports = canManage(role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        // On wide web the persistent DesktopSidebar (in the (app) layout)
        // replaces the bottom bar, so hide it there.
        tabBarStyle: isWide
          ? { display: 'none' }
          : { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: t('tabs.nav.home'),
          tabBarIcon: icon('home-outline'),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tabs.Screen
        name="projects/index"
        options={{ title: t('tabs.nav.projects'), tabBarIcon: icon('folder-outline') }}
      />
      <Tabs.Screen
        name="invoices/index"
        options={{ title: t('tabs.nav.invoices'), tabBarIcon: icon('receipt-outline') }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: t('tabs.nav.reports'),
          href: showReports ? undefined : null,
          tabBarIcon: icon('bar-chart-outline'),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{ title: t('tabs.nav.settings'), tabBarIcon: icon('settings-outline') }}
      />
    </Tabs>
  );
}
