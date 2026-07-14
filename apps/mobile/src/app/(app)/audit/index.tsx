import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Card, EmptyState, IconBadge, StackScreen, Txt, spacing } from '@chrono/ui';
import { auditActionLabel, auditIcon, canManage, describeAudit } from '@chrono/sdk';
import type { AuditEntry } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useAuditLog } from '@/lib/hooks/use-audit';
import { usePagination } from '@/lib/hooks/use-pagination';
import { relativeTime } from '@/lib/date';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadMore } from '@/components/common/LoadMore';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <View style={styles.row}>
      <IconBadge
        name={auditIcon(entry.action) as IoniconName}
        tone="textMuted"
        background="fill"
      />
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
  const t = useT();
  const router = useRouter();
  const { companyId, role } = useActiveCompany();
  const { data, isLoading, error, refetch } = useAuditLog(companyId ?? undefined);

  const list = useMemo(() => data ?? [], [data]);
  const { page, hasMore, loadMore } = usePagination(list, companyId ?? '');

  // Managers/admins only — guard direct navigation.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('details.auditLog')} onBack={() => router.back()}>
      {isLoading && data == null ? (
        <ScreenLoader />
      ) : error && data == null ? (
        <ErrorState
          error={error}
          title={t('details.auditLoadError')}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={t('details.nothingLogged')}
          subtitle={t('details.nothingLoggedSubtitle')}
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
  body: { flex: 1, gap: 2 },
});
