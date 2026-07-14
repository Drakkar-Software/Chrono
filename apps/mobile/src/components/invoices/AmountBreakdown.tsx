import { StyleSheet, View } from 'react-native';
import { Money, Row, spacing } from '@chrono/ui';
import { invoiceAmounts } from '@chrono/sdk';
import type { Invoice } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface AmountBreakdownProps {
  invoice: Pick<
    Invoice,
    | 'earned_cents'
    | 'credit_brought_forward_cents'
    | 'amount_due_cents'
    | 'amount_paid_cents'
    | 'credit_carried_forward_cents'
  >;
  currency: string;
}

/** Full money breakdown for an invoice (earned → carried forward). */
export function AmountBreakdown({ invoice, currency }: AmountBreakdownProps) {
  const t = useT();
  const a = invoiceAmounts(invoice);
  return (
    <View style={styles.wrap}>
      <Row label={t('comp.invoice.earned')}>
        <Money cents={a.earnedCents} currency={currency} />
      </Row>
      <Row label={t('comp.invoice.creditBroughtForward')}>
        <Money cents={a.creditBroughtForwardCents} currency={currency} tone="textMuted" />
      </Row>
      <Row label={t('comp.invoice.amountDue')}>
        <Money cents={a.amountDueCents} currency={currency} variant="heading" />
      </Row>
      <Row label={t('comp.invoice.paid')}>
        <Money cents={a.amountPaidCents} currency={currency} tone="success" />
      </Row>
      <Row label={t('comp.invoice.outstanding')}>
        <Money cents={a.outstandingCents} currency={currency} tone={a.outstandingCents > 0 ? 'warning' : 'textMuted'} />
      </Row>
      <Row label={t('comp.invoice.carriedForward')}>
        <Money cents={a.creditCarriedForwardCents} currency={currency} tone="textMuted" />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
