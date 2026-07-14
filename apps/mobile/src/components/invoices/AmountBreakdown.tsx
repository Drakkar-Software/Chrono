import { StyleSheet, View } from 'react-native';
import { Money, Row, spacing } from '@chrono/ui';
import { invoiceAmounts } from '@chrono/sdk';
import type { Invoice } from '@chrono/sdk';

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
  const a = invoiceAmounts(invoice);
  return (
    <View style={styles.wrap}>
      <Row label="Earned">
        <Money cents={a.earnedCents} currency={currency} />
      </Row>
      <Row label="Credit brought forward">
        <Money cents={a.creditBroughtForwardCents} currency={currency} tone="textMuted" />
      </Row>
      <Row label="Amount due">
        <Money cents={a.amountDueCents} currency={currency} variant="heading" />
      </Row>
      <Row label="Paid">
        <Money cents={a.amountPaidCents} currency={currency} tone="success" />
      </Row>
      <Row label="Outstanding">
        <Money cents={a.outstandingCents} currency={currency} tone={a.outstandingCents > 0 ? 'warning' : 'textMuted'} />
      </Row>
      <Row label="Carried forward">
        <Money cents={a.creditCarriedForwardCents} currency={currency} tone="textMuted" />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
