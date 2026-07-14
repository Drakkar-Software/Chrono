import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Txt, spacing } from '@chrono/ui';
import { displayName, formatDuration } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { RejectDialog } from '@/components/approvals/RejectDialog';

export interface ApprovalRowProps {
  entry: TimeEntryWithProject & { profile?: { full_name: string | null } | null };
  onApprove: () => void;
  /** Reject with a required, user-typed reason. */
  onReject: (reason: string) => void;
  isBusy?: boolean;
  /** When set, shows a selection checkbox for bulk actions. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

/** A pending time entry with approve / reject (with reason) + optional selection. */
export function ApprovalRow({
  entry,
  onApprove,
  onReject,
  isBusy = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: ApprovalRowProps) {
  const t = useT();
  const [rejecting, setRejecting] = useState(false);

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.head}>
        {selectable ? (
          <IconButton
            name={selected ? 'checkbox' : 'square-outline'}
            tone={selected ? 'accent' : 'textMuted'}
            size={22}
            onPress={onToggleSelect}
            disabled={isBusy}
            accessibilityLabel={selected ? t('compb.approval.deselect') : t('compb.approval.select')}
          />
        ) : null}
        <View style={styles.info}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {entry.project?.name ?? t('compb.approval.project')}
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
      {rejecting ? (
        <RejectDialog
          onConfirm={(reason) => {
            onReject(reason);
            setRejecting(false);
          }}
          onCancel={() => setRejecting(false)}
          isBusy={isBusy}
        />
      ) : (
        <View style={styles.actions}>
          <Button title={t('compb.approval.reject')} variant="danger" size="sm" onPress={() => setRejecting(true)} disabled={isBusy} />
          <Button title={t('compb.approval.approve')} variant="primary" size="sm" onPress={onApprove} loading={isBusy} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
