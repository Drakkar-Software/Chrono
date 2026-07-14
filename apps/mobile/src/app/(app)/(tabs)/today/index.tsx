import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, StackScreen, Txt, spacing, useResponsive } from '@chrono/ui';
import { groupByDay, sumDurations, formatDuration, weekBounds } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { toISODate, todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects } from '@/lib/hooks/use-projects';
import { useWeekEntries } from '@/lib/hooks/use-time-entries';
import { useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { LogEntryForm, type LogEntryValues } from '@/components/time/LogEntryForm';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export default function TodayScreen() {
  const router = useRouter();
  const { isWide } = useResponsive();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const weekStart = useMemo(() => weekBounds(todayISO()).start, []);
  const { data: projects } = useMyProjects(userId, companyId ?? undefined);
  const { data: entries, isLoading } = useWeekEntries(userId, companyId ?? undefined, weekStart);
  const { create, isPending } = useTimeEntryMutations();

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
    };
    create(input);
  };

  const week = (
    <View style={styles.section}>
      <SectionHeader eyebrow="This week" title="Logged time" count={entries?.length} />
      <StatRow>
        <StatTile label="Today" value={formatDuration(todayMinutes)} />
        <StatTile label="This week" value={formatDuration(weekMinutes)} tone="accent" />
      </StatRow>
      {isLoading && entries == null ? (
        <ScreenLoader />
      ) : days.length === 0 ? (
        <EmptyState icon="time-outline" title="No entries yet" subtitle="Log your first hours above." />
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
    <StackScreen title="Log">
      <View style={[styles.wrap, isWide && styles.wrapWide]}>
        <View style={isWide ? styles.formCol : undefined}>
          <LogEntryForm projectOptions={projectOptions} onSubmit={onSubmit} isSubmitting={isPending} />
        </View>
        <View style={isWide ? styles.weekCol : undefined}>{week}</View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  wrapWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  formCol: { flexBasis: 320, flexGrow: 0, flexShrink: 0, maxWidth: 340 },
  weekCol: { flex: 1 },
  section: { gap: spacing.md },
  day: { gap: spacing.xs },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
