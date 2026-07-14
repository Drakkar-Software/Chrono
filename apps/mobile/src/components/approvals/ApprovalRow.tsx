import { StyleSheet, View } from 'react-native';
import { Button, Card, Txt, spacing } from '@chrono/ui';
import { displayName, formatDuration } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';

export interface ApprovalRowProps {
  entry: TimeEntryWithProject & { profile?: { full_name: string | null } | null };
  onApprove: () => void;
  onReject: () => void;
  isBusy?: boolean;
}

/** A pending time entry with approve / reject actions. */
export function ApprovalRow({ entry, onApprove, onReject, isBusy = false }: ApprovalRowProps) {
  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.info}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {entry.project?.name ?? 'Project'}
          </Txt>
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {displayName(entry.profile)} · {entry.entry_date.slice(0, 10)}
          </Txt>
          {entry.description ? (
            <Txt variant="caption" tone="textMuted" numberOfLines={2}>
              {entry.description}
            </Txt>
          ) : null}
        </View>
        <Txt variant="bodyMedium" mono tabularNums>
          {formatDuration(entry.duration_minutes)}
        </Txt>
      </View>
      <View style={styles.actions}>
        <Button title="Reject" variant="danger" size="sm" onPress={onReject} disabled={isBusy} />
        <Button title="Approve" variant="primary" size="sm" onPress={onApprove} loading={isBusy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
