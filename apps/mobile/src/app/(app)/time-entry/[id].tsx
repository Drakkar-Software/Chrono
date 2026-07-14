import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, EmptyState, StackScreen, Txt, spacing } from '@chrono/ui';
import type { TablesUpdate } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { useTimeEntry, useTimeEntryMutations } from '@/lib/hooks/use-time-entry-mutations';
import { Loading } from '@/components/Loading';
import { EditEntryForm } from '@/components/time/EditEntryForm';

export default function TimeEntryDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useActiveCompany();

  const { data: entry, isLoading } = useTimeEntry(id, companyId ?? undefined);
  const { update, remove, isPending } = useTimeEntryMutations();

  if (isLoading && !entry) return <Loading />;
  if (!entry) {
    return (
      <StackScreen title="Time entry" onBack={() => router.back()}>
        <Txt variant="body" tone="textMuted">
          Entry not found.
        </Txt>
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
    <StackScreen title="Time entry" onBack={() => router.back()}>
      <View style={styles.wrap}>
        {editable ? (
          <EditEntryForm entry={entry} onSave={save} onDelete={del} isSaving={isPending} />
        ) : (
          <Card padding="lg">
            <EmptyState
              icon="lock-closed-outline"
              title="Locked"
              subtitle="Only pending, uninvoiced entries can be edited."
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
