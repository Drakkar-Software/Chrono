import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@chrono/ui';
import { canManage } from '@chrono/sdk';
import { useActiveCompany } from '@/lib/active-company-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const icon = (name: IoniconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

/** Web tab bar. `reports` is manager-only (`href: null` hides it otherwise). */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { role } = useActiveCompany();
  const showReports = canManage(role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="home/index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="today/index" options={{ title: 'Log', tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen
        name="projects/index"
        options={{ title: 'Projects', tabBarIcon: icon('folder-outline') }}
      />
      <Tabs.Screen
        name="invoices/index"
        options={{ title: 'Invoices', tabBarIcon: icon('receipt-outline') }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          href: showReports ? undefined : null,
          tabBarIcon: icon('bar-chart-outline'),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }}
      />
    </Tabs>
  );
}
