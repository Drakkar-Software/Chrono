import { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, StackScreen, spacing } from '@chrono/ui';
import { yearBounds } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useUserTimeOff } from '@/lib/hooks/use-time-off';
import { TimeOffRow } from '@/components/time/TimeOffRow';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

export default function VacationListScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId } = useActiveCompany();
  const userId = user?.id;

  const yearRange = useMemo(() => yearBounds(todayISO()), []);
  const { data, isLoading, error, refetch } = useUserTimeOff(
    userId,
    companyId ?? undefined,
    yearRange.start,
    yearRange.end,
  );

  const vacations = useMemo(
    () =>
      [...(data ?? [])]
        .filter((o) => o.kind === 'vacation')
        .sort((a, b) => (a.off_date < b.off_date ? 1 : -1)),
    [data],
  );

  const empty =
    isLoading && data == null ? (
      <ScreenLoader />
    ) : error && data == null ? (
      <ErrorState
        error={error}
        title={t('details.vacationLoadError')}
        onRetry={() => {
          void refetch();
        }}
      />
    ) : (
      <EmptyState
        icon="calendar-outline"
        title={t('details.noVacation')}
        subtitle={t('details.noVacationSubtitle')}
        tone="accent"
      />
    );

  return (
    <StackScreen title={t('details.vacation')} onBack={() => router.back()} scroll={false}>
      <FlatList
        data={vacations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={empty}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TimeOffRow timeOff={item} onPress={() => router.push(`/time-off/${item.id}`)} />
        )}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs, flexGrow: 1 },
});
