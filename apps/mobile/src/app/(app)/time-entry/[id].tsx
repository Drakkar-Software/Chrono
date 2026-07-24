import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Card, EmptyState, Row, StackScreen, Txt, spacing } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, formatDuration, minutesToDays, monthBounds, monthKey } from '@chrono/sdk';
import type { TablesUpdate } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { shortMonthLabel, todayISO } from '@/lib/date';
import { useActiveCompany } from '@/lib/active-company-context';
import { useTimeEntry, useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useMaxBusinessDays } from '@/lib/hooks/use-max-business-days';
import { timeEntryBadge } from '@/lib/status';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { EditEntryForm } from '@/components/time/EditEntryForm';

/** Pending uninvoiced entries can be edited / deleted (RLS: owners may only mutate pending). */
function isEditable(entry: { status: string; invoice_id: string | null }): boolean {
  return entry.status === 'pending' && entry.invoice_id == null;
}

export default function TimeEntryDetail() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useActiveCompany();

  const { data: entry, isLoading, error, refetch } = useTimeEntry(id, companyId ?? undefined);
  const { update, remove, isPending, error: mutError } = useTimeEntryMutations();

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
        .filter((e) => e.id !== entry?.id)
        .reduce(
          (acc, e) =>
            acc + minutesToDays(e.duration_minutes, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY),
          0,
        ),
    [monthEntries, entry?.id],
  );

  if (isLoading && !entry) {
    return (
      <StackScreen title={t('details.timeEntry')} onBack={() => router.back()}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (error && !entry) {
    return (
      <StackScreen title={t('details.timeEntry')} onBack={() => router.back()}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </StackScreen>
    );
  }
  if (!entry) {
    return (
      <StackScreen title={t('details.timeEntry')} onBack={() => router.back()}>
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

  return (
    <StackScreen title={t('details.timeEntry')} onBack={() => router.back()}>
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
            <Txt variant="bodyMedium" mono tabularNums>
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
});
