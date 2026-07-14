import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, StackScreen, Txt, spacing, useResponsive } from '@chrono/ui';
import { buildCopiedEntries, groupByDay, shiftEntryDate, sumDurations, formatDuration, weekBounds } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { toISODate, todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects } from '@/lib/hooks/use-projects';
import { useWeekEntries } from '@/lib/hooks/use-time-entries';
import { useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { LogEntryForm, type LogEntryValues } from '@/components/time/LogEntryForm';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { WeekGrid } from '@/components/time/WeekGrid';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export default function TodayScreen() {
  const t = useT();
  const router = useRouter();
  const { isWide } = useResponsive();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const weekStart = useMemo(() => weekBounds(todayISO()).start, []);
  const lastWeekStart = useMemo(() => shiftEntryDate(weekStart, -7), [weekStart]);
  const { data: projects } = useMyProjects(userId, companyId ?? undefined);
  const { data: entries, isLoading, error, refetch } = useWeekEntries(userId, companyId ?? undefined, weekStart);
  const { data: lastWeekEntries } = useWeekEntries(userId, companyId ?? undefined, lastWeekStart);
  const { create, isPending } = useTimeEntryMutations();
  const [copying, setCopying] = useState(false);

  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
    [projects],
  );

  const todayKey = useMemo(() => todayISO(), []);
  const todayMinutes = useMemo(
    () => sumDurations((entries ?? []).filter((e) => e.entry_date.slice(0, 10) === todayKey)),
    [entries, todayKey],
  );
  const weekMinutes = useMemo(() => sumDurations(entries ?? []), [entries]);

  const days = useMemo(() => {
    const grouped = groupByDay(entries ?? []);
    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: grouped[date] }));
  }, [entries]);

  const onSubmit = (values: LogEntryValues) => {
    if (!userId || !companyId) return;
    const input: TablesInsert<'time_entries'> = {
      project_id: values.projectId,
      user_id: userId,
      company_id: companyId,
      entry_date: toISODate(values.entryDate),
      duration_minutes: values.durationMinutes,
      description: values.description || null,
      billable: values.billable,
      tags: values.tags,
    };
    create(input);
  };

  const copyLastWeek = async () => {
    if (!userId || !companyId || !lastWeekEntries?.length) return;
    setCopying(true);
    try {
      const copies = buildCopiedEntries(lastWeekEntries, 7);
      for (const c of copies) {
        await create({ ...c, user_id: userId, company_id: companyId } as TablesInsert<'time_entries'>);
      }
      await refetch();
    } finally {
      setCopying(false);
    }
  };

  const lastWeekCount = lastWeekEntries?.length ?? 0;

  const week = (
    <View style={styles.section}>
      <SectionHeader eyebrow={t('tabs.today.thisWeek')} title={t('tabs.today.loggedTime')} count={entries?.length} />
      <StatRow>
        <StatTile label={t('tabs.today.today')} value={formatDuration(todayMinutes)} />
        <StatTile label={t('tabs.today.thisWeek')} value={formatDuration(weekMinutes)} tone="accent" />
      </StatRow>
      <WeekGrid entries={entries ?? []} weekStart={weekStart} />
      {isLoading && entries == null ? (
        <ScreenLoader />
      ) : error && entries == null ? (
        <ErrorState
          error={error}
          title={t('tabs.today.loadError')}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : days.length === 0 ? (
        <EmptyState icon="time-outline" title={t('tabs.today.noEntries')} subtitle={t('tabs.today.noEntriesSubtitle')} />
      ) : (
        days.map((day) => (
          <View key={day.date} style={styles.day}>
            <View style={styles.dayHeader}>
              <Txt variant="label" tone="textMuted" uppercase>
                {day.date}
              </Txt>
              <Txt variant="label" tone="textMuted" mono>
                {formatDuration(sumDurations(day.items))}
              </Txt>
            </View>
            {day.items.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                entry={entry}
                onPress={
                  entry.status === 'pending' && entry.invoice_id == null
                    ? () => router.push(`/time-entry/${entry.id}`)
                    : undefined
                }
              />
            ))}
          </View>
        ))
      )}
    </View>
  );

  return (
    <StackScreen title={t('tabs.today.title')} onBack={() => router.back()}>
      <View style={[styles.wrap, isWide && styles.wrapWide]}>
        <View style={isWide ? styles.formCol : undefined}>
          <LogEntryForm projectOptions={projectOptions} onSubmit={onSubmit} isSubmitting={isPending} />
          {lastWeekCount > 0 ? (
            <View style={styles.copyBtn}>
              <Button
                title={t('tabs.today.copyLastWeek', { n: lastWeekCount })}
                variant="secondary"
                onPress={copyLastWeek}
                loading={copying}
                fullWidth
              />
            </View>
          ) : null}
        </View>
        <View style={isWide ? styles.weekCol : undefined}>{week}</View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  wrapWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  formCol: { flexBasis: 320, flexGrow: 0, flexShrink: 0, maxWidth: 340, gap: spacing.sm },
  weekCol: { flex: 1 },
  copyBtn: { marginTop: spacing.xs },
  section: { gap: spacing.md },
  day: { gap: spacing.xs },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
