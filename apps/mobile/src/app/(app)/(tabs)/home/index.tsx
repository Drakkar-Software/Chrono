import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, IconButton, Money, StackScreen, Txt, spacing, useResponsive } from '@chrono/ui';
import {
  DEFAULT_HOURS_PER_DAY,
  approvedUnpaidCents,
  canManage,
  companyCurrency,
  effectiveTjm,
  formatDuration,
  formatMoney,
  fullDayOffDatesInMonth,
  groupByDay,
  minutesToDays,
  monthBounds,
  monthKey,
  partialOffMinutesByDate,
  shiftMonth,
  sumDurations,
  sumReferralEarnings,
} from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { shortMonthLabel, todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useVisibleProjects } from '@/lib/hooks/use-visible-projects';
import { useCompanyProjectMembers } from '@/lib/hooks/use-project-members';
import { useMaxBusinessDays } from '@/lib/hooks/use-max-business-days';
import { useVacationPolicy } from '@/lib/hooks/use-vacation-policy';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { usePendingApprovals } from '@/lib/hooks/use-approvals';
import { useNotificationsFeed } from '@/lib/notifications-context';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { DayGroupHeader } from '@/components/time/DayGroupHeader';
import { MonthCalendar } from '@/components/time/MonthCalendar';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

const RECENT_LIMIT = 5;
const MY_PROJECTS_LIMIT = 4;

/** Effective day rate for one of this person's time entries, resolved from their project-member override, else the project default. */
function rateForEntry(entry: TimeEntryWithProject, membersByProjectAndUser: Map<string, { tjm_cents: number | null }>): number {
  const member = membersByProjectAndUser.get(`${entry.project_id}:${entry.user_id}`);
  return effectiveTjm(member, { default_tjm_cents: entry.project?.default_tjm_cents ?? null });
}

/** A day count, trimmed to a whole number unless it's fractional (partial days off). */
function fmtDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const { isWide } = useResponsive();
  const { user } = useAppAuth();
  const { companyId, company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);
  const userId = user?.id;

  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthKey(todayISO()));
  const month = useMemo(() => monthBounds(selectedMonthKey), [selectedMonthKey]);
  const today = useMemo(() => todayISO(), []);
  const monthLabel = useMemo(
    () => `${shortMonthLabel(selectedMonthKey.slice(0, 7))} ${selectedMonthKey.slice(0, 4)}`,
    [selectedMonthKey],
  );

  const monthEntries = useTimeEntries({
    companyId: companyId ?? '',
    userId,
    from: month.start,
    to: month.end,
  });
  const { data: invoices } = useInvoices({
    companyId: companyId ?? '',
    freelancerId: manager ? undefined : userId,
  });
  // Approved billable work not yet invoiced counts toward "to collect" too —
  // fetched company-wide for managers, personal-only for freelancers, same
  // split as the invoices query above.
  const uninvoicedEntries = useTimeEntries({
    companyId: companyId ?? '',
    userId: manager ? undefined : userId,
    status: 'approved',
    billable: true,
    uninvoiced: true,
  });
  const { data: companyProjectMembers } = useCompanyProjectMembers(companyId ?? undefined);
  const { data: referralEarnings } = useReferralEarnings({
    companyId: companyId ?? undefined,
    referrerId: manager ? undefined : userId,
  });
  const visibleProjects = useVisibleProjects(role, userId, companyId ?? undefined);
  const { data: pending } = usePendingApprovals(manager ? companyId ?? undefined : undefined);
  const { netBusinessDays, netRemainingBusinessDays, workingWeekdays, holidayDates, timeOff } = useMaxBusinessDays(
    userId,
    selectedMonthKey,
  );
  const { maxVacationDaysPerYear, vacationDaysUsed, vacationDaysRemaining } = useVacationPolicy(
    userId,
    workingWeekdays,
    holidayDates,
  );
  const { unread } = useNotificationsFeed();

  const monthMinutes = useMemo(() => sumDurations(monthEntries.data ?? []), [monthEntries.data]);
  const workedDays = useMemo(
    () =>
      (monthEntries.data ?? []).reduce(
        (acc, e) => acc + minutesToDays(e.duration_minutes, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY),
        0,
      ),
    [monthEntries.data],
  );

  const membersByProjectAndUser = useMemo(() => {
    const map = new Map<string, { tjm_cents: number | null }>();
    for (const m of companyProjectMembers ?? []) map.set(`${m.project_id}:${m.user_id}`, m);
    return map;
  }, [companyProjectMembers]);
  const uninvoicedApproved = useMemo(
    () =>
      (uninvoicedEntries.data ?? []).map((e) => ({
        project_id: e.project_id,
        duration_minutes: e.duration_minutes,
        hours_per_day: e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY,
        rate_cents: rateForEntry(e, membersByProjectAndUser),
      })),
    [uninvoicedEntries.data, membersByProjectAndUser],
  );
  const invoicedOnlyCents = useMemo(() => approvedUnpaidCents(invoices ?? []), [invoices]);
  const dueReferralCents = useMemo(
    () => sumReferralEarnings((referralEarnings ?? []).filter((e) => e.settled_at == null)),
    [referralEarnings],
  );
  const toCollectCents = useMemo(
    () => approvedUnpaidCents(invoices ?? [], uninvoicedApproved) + dueReferralCents,
    [invoices, uninvoicedApproved, dueReferralCents],
  );
  const pendingCollectionCents = toCollectCents - invoicedOnlyCents;

  const minutesByDay = useMemo(() => {
    const grouped = groupByDay(monthEntries.data ?? []);
    const out: Record<string, number> = {};
    for (const [date, entries] of Object.entries(grouped)) out[date] = sumDurations(entries);
    return out;
  }, [monthEntries.data]);

  const fullDayOffDates = useMemo(
    () => fullDayOffDatesInMonth(timeOff, selectedMonthKey),
    [timeOff, selectedMonthKey],
  );
  const partialOffDates = useMemo(
    () => Object.keys(partialOffMinutesByDate(timeOff, selectedMonthKey)),
    [timeOff, selectedMonthKey],
  );

  const pendingCount = (pending ?? []).length;

  // The 5 most recent entries this month, grouped by day for the preview.
  const recentDays = useMemo(() => {
    const sorted = [...(monthEntries.data ?? [])]
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
      .slice(0, RECENT_LIMIT);
    const grouped = groupByDay(sorted);
    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: grouped[date] }));
  }, [monthEntries.data]);

  const initialLoading = monthEntries.isLoading && monthEntries.data == null;

  if (initialLoading) {
    return (
      <StackScreen title={t('tabs.nav.home')}>
        <ScreenLoader />
      </StackScreen>
    );
  }

  // A failed primary load must read as an error, not a zeroed-out dashboard
  // (0h / €0 / no projects) indistinguishable from a genuinely empty account.
  if (monthEntries.error && monthEntries.data == null) {
    return (
      <StackScreen title={t('tabs.nav.home')}>
        <ErrorState error={monthEntries.error} onRetry={() => void monthEntries.refetch()} />
      </StackScreen>
    );
  }

  const visibleProjectsList = (visibleProjects.data ?? [])
    .filter((p) => p.status === 'active')
    .slice(0, MY_PROJECTS_LIMIT);

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
            <StatTile label={monthLabel}>
              <View>
                <Txt variant="heading" mono tabularNums tone="accent" numberOfLines={1}>
                  {formatDuration(monthMinutes)}
                </Txt>
                <Txt variant="caption" tone="textMuted" mono numberOfLines={1}>
                  {t('tabs.home.periodDays', {
                    worked: workedDays.toFixed(1),
                    max: netBusinessDays,
                    remaining: netRemainingBusinessDays,
                  })}
                </Txt>
              </View>
            </StatTile>
            <StatTile label={t('tabs.home.outstanding')}>
              <View>
                <Money cents={toCollectCents} currency={currency} variant="heading" mono />
                <Txt variant="caption" tone="textMuted" numberOfLines={1}>
                  {t('tabs.home.toCollectBreakdown', {
                    invoiced: formatMoney(invoicedOnlyCents, currency),
                    pending: formatMoney(pendingCollectionCents, currency),
                  })}
                </Txt>
              </View>
            </StatTile>
            {maxVacationDaysPerYear != null ? (
              <StatTile
                label={t('tabs.home.congesLeft')}
                value={`${fmtDays(vacationDaysRemaining ?? 0)} / ${maxVacationDaysPerYear}`}
              />
            ) : (
              <StatTile label={t('tabs.home.congesTaken')} value={fmtDays(vacationDaysUsed)} />
            )}
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
            eyebrow={monthLabel}
            title={t('tabs.home.workCalendar')}
            action={
              <View style={styles.monthStepper}>
                <IconButton
                  name="chevron-back"
                  size={18}
                  onPress={() => setSelectedMonthKey((k) => shiftMonth(k, -1))}
                  accessibilityLabel={t('tabs.home.prevMonth')}
                />
                <IconButton
                  name="chevron-forward"
                  size={18}
                  onPress={() => setSelectedMonthKey((k) => shiftMonth(k, 1))}
                  accessibilityLabel={t('tabs.home.nextMonth')}
                />
              </View>
            }
          />
          <Card padding="lg">
            <MonthCalendar
              monthISO={selectedMonthKey}
              minutesByDay={minutesByDay}
              workingWeekdays={workingWeekdays}
              holidayDates={holidayDates}
              fullDayOffDates={fullDayOffDates}
              partialOffDates={partialOffDates}
              today={today}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={t('tabs.home.myProjects')}
            action={
              visibleProjectsList.length > 0 ? (
                <Button title={t('tabs.home.viewAll')} variant="ghost" size="sm" onPress={() => router.push('/projects')} />
              ) : undefined
            }
          />
          {visibleProjectsList.length === 0 ? (
            <EmptyState icon="folder-outline" title={t('tabs.home.noProjects')} tone="accent" />
          ) : (
            <View style={styles.projectList}>
              {visibleProjectsList.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  currency={currency}
                  onPress={() => router.push(`/project/${project.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            eyebrow={monthLabel}
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
  monthStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.md },
  actions: { gap: spacing.sm },
  actionsWide: { flexDirection: 'row' },
  action: { flexGrow: 1, flexBasis: 0, minWidth: 160 },
  recentCard: { gap: spacing.xs },
  day: { gap: spacing.xs },
  projectList: { gap: spacing.sm },
});
