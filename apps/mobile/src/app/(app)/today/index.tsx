import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, IconButton, StackScreen, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import {
  DEFAULT_HOURS_PER_DAY,
  buildCopiedEntries,
  groupByDay,
  minutesToDays,
  monthBounds,
  monthKey,
  shiftEntryDate,
  sumDurations,
  formatDuration,
  weekBounds,
} from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { shortMonthLabel, toISODate, todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects } from '@/lib/hooks/use-projects';
import { useTimeEntries, useWeekEntries } from '@/lib/hooks/use-time-entries';
import { useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { useMaxBusinessDays } from '@/lib/hooks/use-max-business-days';
import { useTimeOffMutations } from '@/lib/hooks/use-time-off';
import { LogEntryForm, type LogEntryValues } from '@/components/time/LogEntryForm';
import { TimeOffForm, type TimeOffValues } from '@/components/time/TimeOffForm';
import { DayGroupHeader } from '@/components/time/DayGroupHeader';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { WeekStrip } from '@/components/time/WeekStrip';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export default function TodayScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const weekStart = useMemo(() => weekBounds(todayISO()).start, []);
  const lastWeekStart = useMemo(() => shiftEntryDate(weekStart, -7), [weekStart]);
  const month = useMemo(() => monthBounds(todayISO()), []);
  const thisMonthKey = useMemo(() => monthKey(todayISO()), []);
  const monthLabel = useMemo(() => shortMonthLabel(thisMonthKey.slice(0, 7)), [thisMonthKey]);
  const { data: projects } = useMyProjects(userId, companyId ?? undefined);
  const { data: entries, isLoading, error, refetch } = useWeekEntries(userId, companyId ?? undefined, weekStart);
  const { data: lastWeekEntries } = useWeekEntries(userId, companyId ?? undefined, lastWeekStart);
  const { data: monthEntries } = useTimeEntries({
    companyId: companyId ?? '',
    userId,
    from: month.start,
    to: month.end,
  });
  const { netBusinessDays, timeOff } = useMaxBusinessDays(userId, thisMonthKey);
  const { create, isPending } = useTimeEntryMutations();
  const { add: addTimeOff, remove: removeTimeOff, isPending: isSubmittingTimeOff, error: timeOffError } =
    useTimeOffMutations();
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduceMotion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
    [projects],
  );
  const hoursPerDayByProject = useMemo(
    () => Object.fromEntries((projects ?? []).map((p) => [p.id, p.hours_per_day])),
    [projects],
  );
  const monthDaysLogged = useMemo(
    () =>
      (monthEntries ?? []).reduce(
        (acc, e) => acc + minutesToDays(e.duration_minutes, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY),
        0,
      ),
    [monthEntries],
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
    setShowForm(false);
  };

  const onSubmitTimeOff = async (values: TimeOffValues) => {
    if (!userId || !companyId) return;
    const input: TablesInsert<'time_off'> = {
      company_id: companyId,
      user_id: userId,
      off_date: toISODate(values.offDate),
      duration_minutes: values.durationMinutes,
      kind: values.kind,
      note: values.note || null,
    };
    await addTimeOff(input);
    setShowTimeOffForm(false);
  };

  const copyLastWeek = async () => {
    if (!userId || !companyId || !lastWeekEntries?.length) return;
    setCopying(true);
    setCopyError(null);
    // Keep going if one insert fails (offline/RLS) rather than aborting mid-copy
    // and leaving a silent partial result; report how many didn't copy.
    let failed = 0;
    try {
      const copies = buildCopiedEntries(lastWeekEntries, 7);
      for (const c of copies) {
        try {
          await create({ ...c, user_id: userId, company_id: companyId } as TablesInsert<'time_entries'>);
        } catch {
          failed += 1;
        }
      }
      await refetch();
      if (failed > 0) setCopyError(t('tabs.today.copyPartial', { n: failed }));
    } finally {
      setCopying(false);
    }
  };

  const lastWeekCount = lastWeekEntries?.length ?? 0;

  return (
    <StackScreen title={t('tabs.today.title')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <StatRow>
          <StatTile label={t('tabs.today.today')} value={formatDuration(todayMinutes)} />
          <StatTile label={t('tabs.today.thisWeek')} value={formatDuration(weekMinutes)} tone="accent" />
        </StatRow>

        <View style={styles.actions}>
          <Button title={t('tabs.today.logTimeCta')} onPress={() => setShowForm(true)} fullWidth />
          <Button
            title={t('comp.timeOff.takeTimeOff')}
            variant="secondary"
            onPress={() => setShowTimeOffForm(true)}
            fullWidth
          />
          {lastWeekCount > 0 ? (
            <Button
              title={t('tabs.today.copyLastWeek', { n: lastWeekCount })}
              variant="secondary"
              onPress={copyLastWeek}
              loading={copying}
              fullWidth
            />
          ) : null}
        </View>
        {copyError ? <InlineError message={copyError} /> : null}

        {timeOff.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('comp.timeOff.thisMonth')} count={timeOff.length} />
            <View style={styles.timeOffList}>
              {timeOff.map((off) => (
                <View key={off.id} style={styles.timeOffRow}>
                  <Txt variant="body" numberOfLines={1} style={styles.timeOffLabel}>
                    {t(`comp.timeOff.kind.${off.kind}`)}
                  </Txt>
                  <Txt variant="caption" tone="textMuted">
                    {off.off_date}
                    {off.duration_minutes != null
                      ? ` · ${formatDuration(off.duration_minutes)}`
                      : ` · ${t('comp.timeOff.fullDay')}`}
                  </Txt>
                  <IconButton
                    name="close"
                    size={18}
                    onPress={() => void removeTimeOff(off.id)}
                    accessibilityLabel={t('common.remove')}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Txt variant="label" tone="textMuted" uppercase>
            {t('tabs.today.weekStrip')}
          </Txt>
          <WeekStrip entries={entries ?? []} weekStart={weekStart} />
        </View>

        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.today.thisWeek')} title={t('tabs.today.loggedTime')} count={entries?.length} />
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
            <EmptyState
              icon="time-outline"
              title={t('tabs.today.noEntries')}
              subtitle={t('tabs.today.noEntriesSubtitle')}
              tone="accent"
              action={<Button title={t('tabs.today.logTimeCta')} onPress={() => setShowForm(true)} />}
            />
          ) : (
            days.map((day) => (
              <View key={day.date} style={styles.day}>
                <DayGroupHeader date={day.date} minutes={sumDurations(day.items)} />
                {day.items.map((entry) => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    onPress={
                      (entry.status === 'pending' && entry.invoice_id == null) ||
                      entry.status === 'rejected'
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

      <Modal
        visible={showForm}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowForm(false)}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setShowForm(false)}>
          <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <LogEntryForm
                projectOptions={projectOptions}
                onSubmit={onSubmit}
                isSubmitting={isPending}
                hoursPerDayByProject={hoursPerDayByProject}
                monthDaysLogged={monthDaysLogged}
                maxBusinessDays={netBusinessDays}
                monthLabel={monthLabel}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTimeOffForm}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowTimeOffForm(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setShowTimeOffForm(false)}
        >
          <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <TimeOffForm onSubmit={onSubmitTimeOff} isSubmitting={isSubmittingTimeOff} />
              <InlineError error={timeOffError} describe={{ duplicateMessage: t('comp.timeOff.errDuplicate') }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  actions: { gap: spacing.sm },
  section: { gap: spacing.md },
  day: { gap: spacing.xs },
  timeOffList: { gap: spacing.xs },
  timeOffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  timeOffLabel: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheetWrap: { width: '100%', maxWidth: 480, maxHeight: '90%' },
  sheet: { borderWidth: borders.thin, borderRadius: radii.lg, overflow: 'hidden' },
  sheetContent: { padding: spacing.lg },
});
