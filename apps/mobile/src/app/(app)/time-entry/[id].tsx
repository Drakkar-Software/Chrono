import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, EmptyState, StackScreen, spacing } from '@chrono/ui';
import type { TablesUpdate } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useTimeEntry, useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { EditEntryForm } from '@/components/time/EditEntryForm';

export default function TimeEntryDetail() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useActiveCompany();

  const { data: entry, isLoading, error, refetch } = useTimeEntry(id, companyId ?? undefined);
  const { update, remove, isPending } = useTimeEntryMutations();

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

  const editable = entry.status === 'pending' && entry.invoice_id == null;

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
        {editable ? (
          <EditEntryForm entry={entry} onSave={save} onDelete={del} isSaving={isPending} />
        ) : entry.status === 'rejected' && entry.rejection_reason ? (
          <Card padding="lg">
            <EmptyState
              icon="close-circle-outline"
              title={t('details.rejectionReason')}
              subtitle={entry.rejection_reason}
              tone="danger"
            />
          </Card>
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
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});
