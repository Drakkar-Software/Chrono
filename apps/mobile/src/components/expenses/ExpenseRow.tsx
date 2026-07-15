import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Money, Txt, spacing } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { ProjectExpense } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { RejectDialog } from '@/components/approvals/RejectDialog';

const STATUS_BADGE = { pending: 'warning', approved: 'success', rejected: 'danger' } as const;

export interface ExpenseRowProps {
  expense: ProjectExpense;
  currency: string;
  submitter?: { full_name: string | null } | null;
  /** Manager-only: approve / reject / mark reimbursed. */
  canModerate?: boolean;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onMarkReimbursed?: () => void;
  isBusy?: boolean;
}

/** One expense: description + submitter/date on the left, amount + status on the right. */
export function ExpenseRow({
  expense,
  currency,
  submitter,
  canModerate = false,
  onApprove,
  onReject,
  onMarkReimbursed,
  isBusy = false,
}: ExpenseRowProps) {
  const t = useT();
  const [rejecting, setRejecting] = useState(false);

  const subtitleParts = [
    submitter ? displayName(submitter) : null,
    expense.spent_on.slice(0, 10),
    expense.category,
  ].filter(Boolean);

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.info}>
          <Txt variant="bodyMedium" numberOfLines={2}>
            {expense.description}
          </Txt>
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Txt>
          {expense.status === 'rejected' && expense.rejection_reason ? (
            <Txt variant="caption" tone="danger" numberOfLines={2}>
              {expense.rejection_reason}
            </Txt>
          ) : null}
        </View>
        <View style={styles.trailing}>
          <Money cents={expense.amount_cents} currency={currency} />
          <Badge label={t('status.' + expense.status)} status={STATUS_BADGE[expense.status]} />
        </View>
      </View>

      {expense.receipt_url ? (
        <Button
          title={t('comp.expense.viewReceipt')}
          variant="ghost"
          size="sm"
          onPress={() => void Linking.openURL(expense.receipt_url!)}
        />
      ) : null}

      {expense.status === 'approved' && expense.reimbursed_at ? (
        <Badge label={t('comp.expense.reimbursed')} status="neutral" />
      ) : null}

      {canModerate && expense.status === 'pending' ? (
        rejecting ? (
          <RejectDialog
            onConfirm={(reason) => {
              onReject?.(reason);
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
        )
      ) : null}

      {canModerate && expense.status === 'approved' && !expense.reimbursed_at ? (
        <View style={styles.actions}>
          <Button title={t('comp.expense.markReimbursed')} variant="secondary" size="sm" onPress={onMarkReimbursed} loading={isBusy} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  trailing: { alignItems: 'flex-end', gap: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
