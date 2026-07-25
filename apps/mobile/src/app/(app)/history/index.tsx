import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Row, Segmented, StackScreen, Txt, spacing } from '@chrono/ui';
import {
  DEFAULT_HOURS_PER_DAY,
  formatDuration,
  groupByDay,
  sumDurations,
} from '@chrono/sdk';
import type { TimeEntryFilters, TimeEntryWithProject, TimeOff } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects } from '@/lib/hooks/use-projects';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useUserTimeOff } from '@/lib/hooks/use-time-off';
import { usePagination } from '@/lib/hooks/use-pagination';
import { rangeBounds } from '@/lib/history-range';
import {
  defaultHistoryFilters,
  HistoryFilters,
  type HistoryFilterState,
  type HistoryMode,
} from '@/components/common/HistoryFilters';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { TimeOffRow } from '@/components/time/TimeOffRow';
import { DayGroupHeader } from '@/components/time/DayGroupHeader';
import { ListFooterSpinner } from '@/components/common/LoadMore';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

type EntryDayGroup = { date: string; items: TimeEntryWithProject[] };
type LeaveDayGroup = { date: string; items: TimeOff[] };

function groupTimeOffByDay(items: TimeOff[]): Record<string, TimeOff[]> {
  const out: Record<string, TimeOff[]> = {};
  for (const item of items) {
    const key = item.off_date.slice(0, 10);
    (out[key] ??= []).push(item);
  }
  return out;
}

function leaveMinutes(items: TimeOff[]): number {
  return items.reduce(
    (acc, o) => acc + (o.duration_minutes ?? DEFAULT_HOURS_PER_DAY * 60),
    0,
  );
}

export default function HistoryScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const [mode, setMode] = useState<HistoryMode>('time');
  const [filters, setFilters] = useState<HistoryFilterState>(() => defaultHistoryFilters());

  const bounds = useMemo(() => rangeBounds(filters.range), [filters.range]);

  const queryFilters: TimeEntryFilters = useMemo(() => {
    return {
      companyId: companyId ?? '',
      userId,
      projectId: filters.projectId === 'all' ? undefined : filters.projectId,
      from: bounds.from,
      to: bounds.to,
      status: filters.status === 'all' ? undefined : filters.status,
      billable: filters.billable === 'all' ? undefined : filters.billable === 'billable',
    };
  }, [companyId, userId, filters, bounds]);

  const {
    data: entries,
    isLoading: entriesLoading,
    error: entriesError,
    refetch: refetchEntries,
  } = useTimeEntries(queryFilters);
  const {
    data: timeOff,
    isLoading: leaveLoading,
    error: leaveError,
    refetch: refetchLeave,
  } = useUserTimeOff(userId, companyId ?? undefined, bounds.from, bounds.to);
  const { data: projects } = useMyProjects(userId, companyId ?? undefined);

  // Most-recent-first so paginated groups read top-down like the Log tab.
  const sortedEntries = useMemo(
    () => [...(entries ?? [])].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    [entries],
  );
  const sortedLeave = useMemo(
    () => [...(timeOff ?? [])].sort((a, b) => (a.off_date < b.off_date ? 1 : -1)),
    [timeOff],
  );
  const totalMinutes = useMemo(() => sumDurations(sortedEntries), [sortedEntries]);

  const entryResetKey = useMemo(() => JSON.stringify({ mode, filters }), [mode, filters]);
  const leaveResetKey = useMemo(
    () => JSON.stringify({ mode, range: filters.range }),
    [mode, filters.range],
  );
  const entryPagination = usePagination(sortedEntries, entryResetKey);
  const leavePagination = usePagination(sortedLeave, leaveResetKey);

  const entryDayGroups: EntryDayGroup[] = useMemo(() => {
    const grouped = groupByDay(entryPagination.page);
    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: grouped[date] }));
  }, [entryPagination.page]);

  const leaveDayGroups: LeaveDayGroup[] = useMemo(() => {
    const grouped = groupTimeOffByDay(leavePagination.page);
    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: grouped[date] }));
  }, [leavePagination.page]);

  const modeOptions = [
    { label: t('details.historySegmentTime'), value: 'time' },
    { label: t('details.historySegmentLeave'), value: 'leave' },
  ];

  const header = (
    <View style={styles.header}>
      <Segmented
        options={modeOptions}
        value={mode}
        onValueChange={(v) => setMode(v as HistoryMode)}
      />
      <HistoryFilters
        projects={projects ?? []}
        value={filters}
        onChange={setFilters}
        mode={mode}
      />
      {mode === 'time' ? (
        <Row
          label={t(
            sortedEntries.length === 1 ? 'details.entryCountOne' : 'details.entryCountOther',
            { n: sortedEntries.length },
          )}
        >
          <Txt variant="bodyMedium" mono tabularNums tone="accent">
            {formatDuration(totalMinutes)}
          </Txt>
        </Row>
      ) : (
        <Row
          label={t(
            sortedLeave.length === 1 ? 'details.leaveCountOne' : 'details.leaveCountOther',
            { n: sortedLeave.length },
          )}
        >
          <Txt variant="bodyMedium" mono tabularNums tone="accent">
            {String(sortedLeave.length)}
          </Txt>
        </Row>
      )}
    </View>
  );

  const timeEmpty =
    entriesLoading && entries == null ? (
      <ScreenLoader />
    ) : entriesError && entries == null ? (
      <ErrorState
        error={entriesError}
        title={t('details.historyLoadError')}
        onRetry={() => {
          void refetchEntries();
        }}
      />
    ) : (
      <EmptyState
        icon="time-outline"
        title={t('details.noEntries')}
        subtitle={t('details.noEntriesSubtitle')}
      />
    );

  const leaveEmpty =
    leaveLoading && timeOff == null ? (
      <ScreenLoader />
    ) : leaveError && timeOff == null ? (
      <ErrorState
        error={leaveError}
        title={t('details.historyLoadError')}
        onRetry={() => {
          void refetchLeave();
        }}
      />
    ) : (
      <EmptyState
        icon="calendar-outline"
        title={t('details.noLeave')}
        subtitle={t('details.noLeaveSubtitle')}
      />
    );

  if (mode === 'leave') {
    return (
      <StackScreen title={t('details.timeHistory')} onBack={() => router.back()} scroll={false}>
        <FlatList
          data={leaveDayGroups}
          keyExtractor={(group) => group.date}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          ListEmptyComponent={leaveEmpty}
          ListFooterComponent={<ListFooterSpinner visible={leavePagination.hasMore} />}
          onEndReached={() => {
            if (leavePagination.hasMore) leavePagination.loadMore();
          }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: day }) => (
            <View style={styles.day}>
              <DayGroupHeader date={day.date} minutes={leaveMinutes(day.items)} />
              {day.items.map((off) => (
                <TimeOffRow
                  key={off.id}
                  timeOff={off}
                  onPress={() => router.push(`/time-off/${off.id}`)}
                />
              ))}
            </View>
          )}
        />
      </StackScreen>
    );
  }

  return (
    <StackScreen title={t('details.timeHistory')} onBack={() => router.back()} scroll={false}>
      <FlatList
        data={entryDayGroups}
        keyExtractor={(group) => group.date}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={timeEmpty}
        ListFooterComponent={<ListFooterSpinner visible={entryPagination.hasMore} />}
        onEndReached={() => {
          if (entryPagination.hasMore) entryPagination.loadMore();
        }}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: day }) => (
          <View style={styles.day}>
            <DayGroupHeader date={day.date} minutes={sumDurations(day.items)} />
            {day.items.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                entry={entry}
                onPress={() => router.push(`/time-entry/${entry.id}`)}
              />
            ))}
          </View>
        )}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.lg, marginBottom: spacing.sm },
  day: { gap: spacing.xs },
});
