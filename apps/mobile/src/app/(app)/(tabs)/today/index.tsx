import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, StackScreen, Txt, spacing } from '@chrono/ui';
import { groupByDay, sumDurations, formatDuration, weekBounds } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects } from '@/lib/hooks/use-projects';
import { useWeekEntries } from '@/lib/hooks/use-time-entries';
import { useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { LogEntryForm, type LogEntryValues } from '@/components/time/LogEntryForm';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const weekStart = useMemo(() => weekBounds(new Date().toISOString()).start, []);
  const { data: projects } = useMyProjects(userId, companyId ?? undefined);
  const { data: entries } = useWeekEntries(userId, companyId ?? undefined, weekStart);
  const { create, isPending } = useTimeEntryMutations();

  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
    [projects],
  );

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
      entry_date: values.entryDate.toISOString().slice(0, 10),
      duration_minutes: values.durationMinutes,
      description: values.description || null,
      billable: values.billable,
    };
    create(input);
  };

  return (
    <StackScreen title="Log">
      <View style={styles.wrap}>
        <LogEntryForm projectOptions={projectOptions} onSubmit={onSubmit} isSubmitting={isPending} />

        <View style={styles.section}>
          <Txt variant="heading">This week</Txt>
          {days.length === 0 ? (
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
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.md },
  day: { gap: spacing.xs },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
