import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Row, StackScreen, Txt, spacing } from '@chrono/ui';
import { formatDuration, groupByDay, sumDurations } from '@chrono/sdk';
import type { TimeEntryFilters, TimeEntryWithProject } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects } from '@/lib/hooks/use-projects';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { usePagination } from '@/lib/hooks/use-pagination';
import { rangeBounds } from '@/lib/history-range';
import {
  defaultHistoryFilters,
  HistoryFilters,
  type HistoryFilterState,
} from '@/components/common/HistoryFilters';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { DayGroupHeader } from '@/components/time/DayGroupHeader';
import { ListFooterSpinner } from '@/components/common/LoadMore';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

type DayGroup = { date: string; items: TimeEntryWithProject[] };

export default function HistoryScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const [filters, setFilters] = useState<HistoryFilterState>(() => defaultHistoryFilters());

  const queryFilters: TimeEntryFilters = useMemo(() => {
    const { from, to } = rangeBounds(filters.range);
    return {
      companyId: companyId ?? '',
      userId,
      projectId: filters.projectId === 'all' ? undefined : filters.projectId,
      from,
      to,
      status: filters.status === 'all' ? undefined : filters.status,
      billable: filters.billable === 'all' ? undefined : filters.billable === 'billable',
    };
  }, [companyId, userId, filters]);

  const { data: entries, isLoading, error, refetch } = useTimeEntries(queryFilters);
  const { data: projects } = useMyProjects(userId, companyId ?? undefined);

  // Most-recent-first so paginated groups read top-down like the Log tab.
  const sorted = useMemo(
    () => [...(entries ?? [])].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    [entries],
  );
  const totalMinutes = useMemo(() => sumDurations(sorted), [sorted]);

  // Reset the visible window whenever the active filters change.
  const resetKey = useMemo(() => JSON.stringify(filters), [filters]);
  const { page, hasMore, loadMore } = usePagination(sorted, resetKey);

  const dayGroups: DayGroup[] = useMemo(() => {
    const grouped = groupByDay(page);
    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: grouped[date] }));
  }, [page]);

  const header = (
    <View style={styles.header}>
      <HistoryFilters projects={projects ?? []} value={filters} onChange={setFilters} />
      <Row
        label={t(sorted.length === 1 ? 'details.entryCountOne' : 'details.entryCountOther', { n: sorted.length })}
      >
        <Txt variant="bodyMedium" mono tabularNums tone="accent">
          {formatDuration(totalMinutes)}
        </Txt>
      </Row>
    </View>
  );

  const empty =
    isLoading && entries == null ? (
      <ScreenLoader />
    ) : error && entries == null ? (
      <ErrorState
        error={error}
        title={t('details.historyLoadError')}
        onRetry={() => {
          void refetch();
        }}
      />
    ) : (
      <EmptyState
        icon="time-outline"
        title={t('details.noEntries')}
        subtitle={t('details.noEntriesSubtitle')}
      />
    );

  return (
    <StackScreen title={t('details.timeHistory')} onBack={() => router.back()} scroll={false}>
      <FlatList
        data={dayGroups}
        keyExtractor={(group) => group.date}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<ListFooterSpinner visible={hasMore} />}
        onEndReached={() => {
          if (hasMore) loadMore();
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
                onPress={
                  (entry.status === 'pending' && entry.invoice_id == null) ||
                  entry.status === 'rejected'
                    ? () => router.push(`/time-entry/${entry.id}`)
                    : undefined
                }
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
