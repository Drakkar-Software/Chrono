import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Card, EmptyState, StackScreen, Txt, spacing, useTheme } from '@chrono/ui';
import { auditActionLabel, auditIcon, describeAudit } from '@chrono/sdk';
import type { AuditEntry } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { useAuditLog } from '@/lib/hooks/use-audit';
import { usePagination } from '@/lib/hooks/use-pagination';
import { relativeTime } from '@/lib/date';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadMore } from '@/components/common/LoadMore';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: colors.fill }]}>
        <Ionicons name={auditIcon(entry.action) as IoniconName} size={18} color={colors.textMuted} />
      </View>
      <View style={styles.body}>
        <Txt variant="bodyMedium">{auditActionLabel(entry.action)}</Txt>
        <Txt variant="caption" tone="textMuted" numberOfLines={2}>
          {describeAudit(entry)}
        </Txt>
        <Txt variant="micro" tone="textFaint">
          {relativeTime(entry.created_at)}
        </Txt>
      </View>
    </View>
  );
}

export default function AuditScreen() {
  const router = useRouter();
  const { companyId } = useActiveCompany();
  const { data, isLoading, error, refetch } = useAuditLog(companyId ?? undefined);

  const list = useMemo(() => data ?? [], [data]);
  const { page, hasMore, loadMore } = usePagination(list, companyId ?? '');

  return (
    <StackScreen title="Audit log" onBack={() => router.back()}>
      {isLoading && data == null ? (
        <ScreenLoader />
      ) : error && data == null ? (
        <ErrorState
          error={error}
          title="Couldn't load the audit log"
          onRetry={() => {
            void refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="Nothing logged yet"
          subtitle="Role changes, settlements and payments are recorded here."
        />
      ) : (
        <View style={styles.wrap}>
          <Card padding="lg" style={styles.card}>
            {page.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </Card>
          <LoadMore hasMore={hasMore} onLoadMore={loadMore} remaining={list.length - page.length} />
        </View>
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
