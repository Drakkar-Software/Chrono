import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Card, EmptyState, Row, StackScreen, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, formatDuration, minutesToDays, monthBounds, monthKey } from '@chrono/sdk';
import type { TablesInsert, TablesUpdate } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { fromISODate, shortMonthLabel, toISODate, todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useTimeEntry, useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useMaxBusinessDays } from '@/lib/hooks/use-max-business-days';
import { timeEntryBadge } from '@/lib/status';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { HeaderOverflowMenu } from '@/components/common/HeaderOverflowMenu';
import { EditEntryForm } from '@/components/time/EditEntryForm';
import { LogEntryForm, type LogEntryDefaults, type LogEntryValues } from '@/components/time/LogEntryForm';
import { formatMinutesAsHoursInput } from '@/components/time/time-entry-form.lib';

/** Pending uninvoiced entries can be edited / deleted (RLS: owners may only mutate pending). */
function isEditable(entry: { status: string; invoice_id: string | null }): boolean {
  return entry.status === 'pending' && entry.invoice_id == null;
}

export default function TimeEntryDetail() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();

  const { data: entry, isLoading, error, refetch } = useTimeEntry(id, companyId ?? undefined);
  const { create, update, remove, isPending, error: mutError } = useTimeEntryMutations();
  const [showQuickCancel, setShowQuickCancel] = useState(false);
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

  // The business-day cap check needs the entry's month + the user's other
  // entries in it — computed unconditionally (before any early return) with
  // a same-shape fallback while `entry` is still loading.
  //
  // KNOWN LIMITATION: this is scoped to the entry's ORIGINAL month
  // (`entry.entry_date`), not whatever date the user picks inside the form.
  // If an edit also moves the entry to a different month, the cap guard
  // still checks against the original month's numbers rather than the
  // target month's — a full fix would need the date picker's value lifted
  // up here so the month-scoped queries can react to it live.
  const entryMonthKey = entry ? monthKey(entry.entry_date) : monthKey(todayISO());
  const entryMonth = useMemo(() => monthBounds(entryMonthKey), [entryMonthKey]);
  const monthLabel = useMemo(() => shortMonthLabel(entryMonthKey.slice(0, 7)), [entryMonthKey]);
  const { data: monthEntries } = useTimeEntries({
    // Gate on `entry` too — without a user_id yet this would otherwise fetch
    // every company entry for the month while the single-row query is still loading.
    companyId: entry ? companyId ?? '' : '',
    userId: entry?.user_id,
    from: entryMonth.start,
    to: entryMonth.end,
  });
  const { maxBusinessDays } = useMaxBusinessDays(entry?.user_id, entryMonthKey);
  const monthDaysLoggedExcludingThis = useMemo(
    () =>
      (monthEntries ?? [])
        .filter((e) => e.id !== entry?.id && e.duration_minutes > 0)
        .reduce(
          (acc, e) =>
            acc + minutesToDays(e.duration_minutes, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY),
          0,
        ),
    [monthEntries, entry?.id],
  );
  // Cap uses positive minutes only — corrections must not free billable headroom.
  const monthDaysLogged = useMemo(
    () =>
      (monthEntries ?? [])
        .filter((e) => e.duration_minutes > 0)
        .reduce(
          (acc, e) =>
            acc + minutesToDays(e.duration_minutes, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY),
          0,
        ),
    [monthEntries],
  );

  const isOwner = !!user?.id && !!entry && user.id === entry.user_id;
  const canQuickCancel = isOwner && !!entry && entry.duration_minutes !== 0;

  const quickCancelDefaults = useMemo((): LogEntryDefaults | undefined => {
    if (!entry) return undefined;
    return {
      projectId: entry.project_id,
      entryDate: fromISODate(entry.entry_date),
      hours: formatMinutesAsHoursInput(-entry.duration_minutes),
      description: t('details.quickCancelDesc', {
        duration: formatDuration(Math.abs(entry.duration_minutes)),
      }),
      billable: true,
      tags: (entry.tags ?? []).join(', '),
    };
  }, [entry, t]);

  const projectOptions = useMemo(() => {
    if (!entry) return [];
    return [{ label: entry.project?.name ?? t('comp.project.fallbackName'), value: entry.project_id }];
  }, [entry, t]);

  const hoursPerDayByProject = useMemo(() => {
    if (!entry) return {};
    return { [entry.project_id]: entry.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY };
  }, [entry]);

  const headerRight = canQuickCancel ? (
    <HeaderOverflowMenu
      accessibilityLabel={t('common.more')}
      items={[
        {
          label: t('details.quickCancel'),
          onPress: () => setShowQuickCancel(true),
        },
      ]}
    />
  ) : undefined;

  if (isLoading && !entry) {
    return (
      <StackScreen title={t('details.timeEntry')} onBack={() => router.back()} headerRight={headerRight}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (error && !entry) {
    return (
      <StackScreen title={t('details.timeEntry')} onBack={() => router.back()} headerRight={headerRight}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </StackScreen>
    );
  }
  if (!entry) {
    return (
      <StackScreen title={t('details.timeEntry')} onBack={() => router.back()} headerRight={headerRight}>
        <EmptyState
          icon="time-outline"
          title={t('details.entryNotFound')}
          subtitle={t('details.mayHaveBeenRemoved')}
        />
      </StackScreen>
    );
  }

  const editable = isEditable(entry);
  const projectName = entry.project?.name ?? t('comp.project.fallbackName');

  const save = async (patch: TablesUpdate<'time_entries'>) => {
    await update(entry.id, patch);
    router.back();
  };
  const del = async () => {
    await remove(entry.id);
    router.back();
  };

  const onQuickCancelSubmit = async (values: LogEntryValues) => {
    if (!user?.id || !companyId) return;
    const input: TablesInsert<'time_entries'> = {
      project_id: values.projectId,
      user_id: user.id,
      company_id: companyId,
      entry_date: toISODate(values.entryDate),
      duration_minutes: values.durationMinutes,
      description: values.description || null,
      billable: values.billable,
      tags: values.tags,
    };
    await create(input);
    setShowQuickCancel(false);
    router.back();
  };

  return (
    <StackScreen title={t('details.timeEntry')} onBack={() => router.back()} headerRight={headerRight}>
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.summary}>
          <View style={styles.summaryHead}>
            <Txt variant="heading" numberOfLines={2} style={styles.summaryTitle}>
              {projectName}
            </Txt>
            <Badge label={t('status.' + entry.status)} status={timeEntryBadge(entry.status)} />
          </View>
          <Row label={t('common.date')}>
            <Txt variant="bodyMedium" mono>
              {entry.entry_date.slice(0, 10)}
            </Txt>
          </Row>
          <Row label={t('comp.time.hours')}>
            <Txt
              variant="bodyMedium"
              mono
              tabularNums
              tone={entry.duration_minutes < 0 ? 'danger' : 'text'}
            >
              {formatDuration(entry.duration_minutes)}
            </Txt>
          </Row>
          {entry.description ? (
            <Row label={t('comp.time.description')}>
              <Txt variant="body" tone="textMuted" style={styles.desc}>
                {entry.description}
              </Txt>
            </Row>
          ) : null}
          <Row label={t('comp.time.billable')}>
            <Txt variant="bodyMedium">
              {entry.billable ? t('comp.time.billable') : t('comp.time.nonBillable')}
            </Txt>
          </Row>
        </Card>

        {entry.status === 'rejected' && entry.rejection_reason ? (
          <Card padding="lg">
            <EmptyState
              icon="close-circle-outline"
              title={t('details.rejectionReason')}
              subtitle={entry.rejection_reason}
              tone="danger"
            />
          </Card>
        ) : null}

        {editable ? (
          <EditEntryForm
            entry={entry}
            onSave={save}
            onDelete={del}
            isSaving={isPending}
            hoursPerDay={entry.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY}
            monthDaysLoggedExcludingThis={monthDaysLoggedExcludingThis}
            maxBusinessDays={maxBusinessDays}
            monthLabel={monthLabel}
          />
        ) : (
          <Card padding="lg">
            <EmptyState
              icon="lock-closed-outline"
              title={t('details.locked')}
              subtitle={t('details.lockedSubtitle')}
              tone="warning"
            />
          </Card>
        )}

        {mutError ? <InlineError error={mutError} /> : null}
      </View>

      <Modal
        visible={showQuickCancel}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowQuickCancel(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setShowQuickCancel(false)}
        >
          <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              {quickCancelDefaults ? (
                <LogEntryForm
                  key={`quick-cancel-${entry.id}`}
                  projectOptions={projectOptions}
                  defaults={quickCancelDefaults}
                  title={t('details.quickCancelTitle')}
                  submitLabel={t('details.quickCancelSubmit')}
                  onSubmit={onQuickCancelSubmit}
                  isSubmitting={isPending}
                  hoursPerDayByProject={hoursPerDayByProject}
                  monthDaysLogged={monthDaysLogged}
                  maxBusinessDays={maxBusinessDays}
                  monthLabel={monthLabel}
                />
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  summary: { gap: spacing.sm },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  summaryTitle: { flex: 1 },
  desc: { flex: 1, textAlign: 'right' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheetWrap: { width: '100%', maxWidth: 480, maxHeight: '90%' },
  sheet: { borderWidth: borders.thin, borderRadius: radii.lg, overflow: 'hidden' },
  sheetContent: { padding: spacing.lg },
});
