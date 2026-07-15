import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BrandMark,
  Txt,
  borders,
  radii,
  spacing,
  useTheme,
} from '@chrono/ui';
import { canManage, companyName } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useNotificationsFeed } from '@/lib/notifications-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type NavItem = {
  key: string;
  label: string;
  icon: IoniconName;
  path: string;
  /** URL stems that mark this item active (defaults to `path`). */
  match?: string[];
  badge?: number;
};

/** One sidebar destination — icon + label with an active accent pill. */
function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(item.path as never)}
      style={({ pressed }) => [
        styles.link,
        {
          backgroundColor: active ? colors.accentBg : pressed ? colors.hover : 'transparent',
          borderRadius: radii.md,
        },
      ]}
    >
      <Ionicons name={item.icon} size={20} color={active ? colors.accent : colors.textMuted} />
      <Txt variant="bodyMedium" tone={active ? 'accent' : 'text'} style={styles.linkLabel} numberOfLines={1}>
        {item.label}
      </Txt>
      {item.badge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Txt variant="micro" color={colors.onOverlay} numberOfLines={1}>
            {item.badge > 9 ? '9+' : String(item.badge)}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Persistent desktop navigation rail, rendered by the (app) layout on wide web
 * in place of the bottom tab bar. Mirrors the tab destinations (Reports is
 * manager-only) and pins Search, Notifications, and Settings to the bottom
 * behind a separator, with the active route pilled.
 */
export function DesktopSidebar() {
  const t = useT();
  const { colors } = useTheme();
  const pathname = usePathname();
  const { company, role } = useActiveCompany();
  const { unread } = useNotificationsFeed();

  const primary: NavItem[] = [
    { key: 'home', label: t('tabs.nav.home'), icon: 'home-outline', path: '/home', match: ['/home'] },
    { key: 'projects', label: t('tabs.nav.projects'), icon: 'folder-outline', path: '/projects', match: ['/projects', '/project'] },
    { key: 'invoices', label: t('tabs.nav.invoices'), icon: 'receipt-outline', path: '/invoices', match: ['/invoices', '/invoice'] },
    ...(canManage(role)
      ? [{ key: 'reports', label: t('tabs.nav.reports'), icon: 'bar-chart-outline' as IoniconName, path: '/reports', match: ['/reports', '/audit'] }]
      : []),
  ];

  const secondary: NavItem[] = [
    { key: 'search', label: t('common.search'), icon: 'search-outline', path: '/search', match: ['/search'] },
    {
      key: 'notifications',
      label: t('details.notifications'),
      icon: 'notifications-outline',
      path: '/notifications',
      match: ['/notifications'],
      badge: unread,
    },
    { key: 'settings', label: t('tabs.nav.settings'), icon: 'settings-outline', path: '/settings', match: ['/settings'] },
  ];

  const isActive = (item: NavItem) =>
    (item.match ?? [item.path]).some((stem) => pathname === stem || pathname.startsWith(`${stem}/`));

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <View style={styles.brand}>
        <BrandMark size={36} shadow={false} />
        <View style={styles.brandText}>
          <Txt variant="heading" weight="bold" numberOfLines={1}>
            Chrono
          </Txt>
          {company ? (
            <Txt variant="caption" tone="textMuted" numberOfLines={1}>
              {companyName(company)}
            </Txt>
          ) : null}
        </View>
      </View>

      <View style={styles.group}>
        {primary.map((item) => (
          <SidebarLink key={item.key} item={item} active={isActive(item)} />
        ))}
      </View>

      <View style={styles.bottomGroup}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.group}>
          {secondary.map((item) => (
            <SidebarLink key={item.key} item={item} active={isActive(item)} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    height: '100%',
    borderRightWidth: borders.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  brandText: { flex: 1, gap: 0 },
  group: { gap: spacing.xs },
  bottomGroup: { marginTop: 'auto', gap: spacing.lg },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  linkLabel: { flex: 1 },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: borders.thin, marginHorizontal: spacing.sm },
});
