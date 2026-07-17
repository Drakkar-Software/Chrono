import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Money, Txt, spacing } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { ProjectCost } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { RejectDialog } from '@/components/approvals/RejectDialog';

const STATUS_BADGE = { pending: 'warning', approved: 'success', rejected: 'danger' } as const;

export interface CostRowProps {
  cost: ProjectCost;
  currency: string;
  submitter?: { full_name: string | null } | null;
  /** Manager-only: moderate a reimbursable, toggle paid, remove. */
  canManage?: boolean;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onMarkReimbursed?: () => void;
  onTogglePaid?: (paid: boolean) => void;
  onToggleActive?: (active: boolean) => void;
  /** Pool kinds only: edit label/amount/schedule (and re-derive the balance impact if paid). */
  onEdit?: () => void;
  onRemove?: () => void;
  isBusy?: boolean;
}

/** One cost of any kind. Pool kinds show their schedule + paid state; a reimbursable shows its lifecycle. */
export function CostRow({
  cost,
  currency,
  submitter,
  canManage = false,
  onApprove,
  onReject,
  onMarkReimbursed,
  onTogglePaid,
  onToggleActive,
  onEdit,
  onRemove,
  isBusy = false,
}: CostRowProps) {
  const t = useT();
  const [rejecting, setRejecting] = useState(false);

  const isReimbursable = cost.kind === 'reimbursable';
  const isRecurring = cost.kind === 'recurring';
  // An auto-deducting recurring cost is paid implicitly every elapsed month —
  // it has no paid_at and must not be shown as unpaid.
  const autoDeducts = isRecurring && cost.auto_deduct;
  const isPaid = cost.paid_at != null || autoDeducts;

  // The CHECK constraints guarantee these per kind, but the generated types are
  // nullable across all kinds — fall back rather than assert.
  const scheduleLabel = () => {
    if (isRecurring) {
      const from = cost.starts_on?.slice(0, 10) ?? '';
      return cost.ends_on
        ? t('comp.cost.recurringUntil', { from, to: cost.ends_on.slice(0, 10) })
        : t('comp.cost.recurringFrom', { from });
    }
    if (cost.kind === 'one_off') {
      return t('comp.cost.oneOffIn', { month: cost.period_month?.slice(0, 7) ?? '' });
    }
    return null;
  };

  const subtitle = isReimbursable
    ? [submitter ? displayName(submitter) : null, cost.spent_on?.slice(0, 10), cost.category]
        .filter(Boolean)
        .join(' · ')
    : scheduleLabel();

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.info}>
          <Txt variant="bodyMedium" numberOfLines={2}>
            {cost.label}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" tone="textMuted" numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
          {isReimbursable && cost.status === 'rejected' && cost.rejection_reason ? (
            <Txt variant="caption" tone="danger" numberOfLines={2}>
              {cost.rejection_reason}
            </Txt>
          ) : null}
        </View>
        <View style={styles.trailing}>
          <Money cents={cost.amount_cents} currency={currency} />
          {isReimbursable && cost.status ? (
            <Badge label={t('status.' + cost.status)} status={STATUS_BADGE[cost.status]} />
          ) : (
            <Badge
              label={autoDeducts ? t('comp.cost.autoDeducted') : isPaid ? t('comp.cost.paid') : t('comp.cost.unpaid')}
              status={isPaid ? 'success' : 'warning'}
            />
          )}
          {!cost.active ? <Badge label={t('comp.cost.inactive')} status="neutral" /> : null}
        </View>
      </View>

      {isReimbursable && cost.receipt_url ? (
        <Button
          title={t('comp.cost.viewReceipt')}
          variant="ghost"
          size="sm"
          onPress={() => void Linking.openURL(cost.receipt_url!)}
        />
      ) : null}

      {isReimbursable && cost.status === 'approved' && cost.reimbursed_at ? (
        <Badge label={t('comp.cost.reimbursed')} status="neutral" />
      ) : null}

      {canManage && isReimbursable && cost.status === 'pending' ? (
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

      {canManage && isReimbursable && cost.status === 'approved' && !cost.reimbursed_at ? (
        <View style={styles.actions}>
          <Button title={t('comp.cost.markReimbursed')} variant="secondary" size="sm" onPress={onMarkReimbursed} loading={isBusy} />
        </View>
      ) : null}

      {/* Pool costs: paid toggle (auto-deducting ones need none), pause, remove. */}
      {canManage && !isReimbursable ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Button
              title={t('common.edit')}
              variant="ghost"
              size="sm"
              onPress={onEdit}
              disabled={isBusy}
            />
          ) : null}
          {onToggleActive ? (
            <Button
              title={cost.active ? t('comp.cost.pause') : t('comp.cost.resume')}
              variant="ghost"
              size="sm"
              onPress={() => onToggleActive(!cost.active)}
              disabled={isBusy}
            />
          ) : null}
          {onTogglePaid && !autoDeducts ? (
            <Button
              title={cost.paid_at ? t('comp.cost.markUnpaid') : t('comp.cost.markPaid')}
              variant="secondary"
              size="sm"
              onPress={() => onTogglePaid(cost.paid_at == null)}
              disabled={isBusy}
            />
          ) : null}
          {onRemove ? (
            <Button
              title={t('common.remove')}
              variant="danger"
              size="sm"
              onPress={onRemove}
              disabled={isBusy}
            />
          ) : null}
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
