import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, IconButton, Money, StackScreen, spacing, useResponsive } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  formatDuration,
  groupByDay,
  monthBounds,
  sumDurations,
  totalOutstanding,
  weekBounds,
} from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects, useProjects } from '@/lib/hooks/use-projects';
import { useTimeEntries, useWeekEntries } from '@/lib/hooks/use-time-entries';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { usePendingApprovals } from '@/lib/hooks/use-approvals';
import { useNotificationsFeed } from '@/lib/notifications-context';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { DayGroupHeader } from '@/components/time/DayGroupHeader';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

const RECENT_LIMIT = 5;

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const { isWide } = useResponsive();
  const { user } = useAppAuth();
  const { companyId, company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);
  const userId = user?.id;

  const month = useMemo(() => monthBounds(todayISO()), []);
  const weekStart = useMemo(() => weekBounds(todayISO()).start, []);

  const monthEntries = useTimeEntries({
    companyId: companyId ?? '',
    userId,
    from: month.start,
    to: month.end,
  });
  const week = useWeekEntries(userId, companyId ?? undefined, weekStart);
  const { data: invoices } = useInvoices({
    companyId: companyId ?? '',
    freelancerId: manager ? undefined : userId,
  });
  // Managers see the company's active projects; freelancers see the ones
  // they're assigned to. Only one of these queries is enabled per role.
  const { data: myProjects } = useMyProjects(!manager ? userId : undefined, !manager ? companyId ?? undefined : undefined);
  const { data: companyProjects } = useProjects(manager ? companyId ?? undefined : undefined);
  const { data: pending } = usePendingApprovals(manager ? companyId ?? undefined : undefined);
  const { unread } = useNotificationsFeed();

  const monthMinutes = useMemo(() => sumDurations(monthEntries.data ?? []), [monthEntries.data]);
  const weekMinutes = useMemo(() => sumDurations(week.data ?? []), [week.data]);
  const outstandingCents = useMemo(() => totalOutstanding(invoices ?? []), [invoices]);
  const activeProjects = manager
    ? (companyProjects ?? []).filter((p) => p.status === 'active').length
    : (myProjects ?? []).length;
  const pendingCount = (pending ?? []).length;

  // The 5 most recent week entries, grouped by day for the preview.
  const recentDays = useMemo(() => {
    const sorted = [...(week.data ?? [])]
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
      .slice(0, RECENT_LIMIT);
    const grouped = groupByDay(sorted);
    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: grouped[date] }));
  }, [week.data]);

  const initialLoading =
    (monthEntries.isLoading && monthEntries.data == null) ||
    (week.isLoading && week.data == null);

  if (initialLoading) {
    return (
      <StackScreen title={t('tabs.nav.home')}>
        <ScreenLoader />
      </StackScreen>
    );
  }

  // A failed primary load must read as an error, not a zeroed-out dashboard
  // (0h / €0 / no projects) indistinguishable from a genuinely empty account.
  if ((monthEntries.error && monthEntries.data == null) || (week.error && week.data == null)) {
    return (
      <StackScreen title={t('tabs.nav.home')}>
        <ErrorState
          error={monthEntries.error ?? week.error}
          onRetry={() => {
            void monthEntries.refetch();
            void week.refetch();
          }}
        />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title={t('tabs.nav.home')}
      headerRight={
        <View style={styles.headerActions}>
          <IconButton name="search-outline" onPress={() => router.push('/search')} accessibilityLabel={t('common.search')} />
          <NotificationBell unread={unread} />
        </View>
      }
    >
      <View style={styles.wrap}>
        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.home.overview')} title={t('tabs.home.yourActivity')} />
          <StatRow>
            <StatTile label={t('tabs.home.thisMonth')} value={formatDuration(monthMinutes)} tone="accent" />
            <StatTile label={t('tabs.home.thisWeek')} value={formatDuration(weekMinutes)} />
            <StatTile label={t('tabs.home.outstanding')}>
              <Money cents={outstandingCents} currency={currency} variant="heading" mono />
            </StatTile>
            <StatTile label={t('tabs.home.activeProjects')} value={String(activeProjects)} />
          </StatRow>
          {manager ? (
            <StatRow>
              <StatTile
                label={t('tabs.home.pendingApprovals')}
                value={String(pendingCount)}
                tone={pendingCount > 0 ? 'warning' : 'text'}
              />
            </StatRow>
          ) : null}
        </View>

        <View style={[styles.actions, isWide && styles.actionsWide]}>
          <View style={styles.action}>
            <Button title={t('tabs.home.logTime')} fullWidth onPress={() => router.push('/today')} />
          </View>
          <View style={styles.action}>
            <Button
              title={t('tabs.home.viewHistory')}
              variant="secondary"
              fullWidth
              onPress={() => router.push('/history')}
            />
          </View>
          {manager ? (
            <View style={styles.action}>
              <Button
                title={t('tabs.nav.reports')}
                variant="secondary"
                fullWidth
                onPress={() => router.push('/reports')}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader
            eyebrow={t('tabs.home.thisWeek')}
            title={t('tabs.home.recentEntries')}
            action={
              recentDays.length > 0 ? (
                <Button title={t('tabs.home.viewAll')} variant="ghost" size="sm" onPress={() => router.push('/history')} />
              ) : undefined
            }
          />
          {recentDays.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title={t('tabs.home.noEntries')}
              subtitle={t('tabs.home.noEntriesSubtitle')}
              action={<Button title={t('tabs.home.logTime')} onPress={() => router.push('/today')} />}
              tone="accent"
            />
          ) : (
            <Card padding="lg" style={styles.recentCard}>
              {recentDays.map((day) => (
                <View key={day.date} style={styles.day}>
                  <DayGroupHeader date={day.date} minutes={sumDurations(day.items)} />
                  {day.items.map((entry) => (
                    <TimeEntryRow key={entry.id} entry={entry} />
                  ))}
                </View>
              ))}
            </Card>
          )}
        </View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.md },
  actions: { gap: spacing.sm },
  actionsWide: { flexDirection: 'row' },
  action: { flexGrow: 1, flexBasis: 0, minWidth: 160 },
  recentCard: { gap: spacing.xs },
  day: { gap: spacing.xs },
});
