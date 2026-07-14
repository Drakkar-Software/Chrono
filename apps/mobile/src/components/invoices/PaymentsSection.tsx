import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, DatePicker, IconButton, Money, Picker, Row, TextField, Txt, spacing } from '@chrono/ui';
import { PAYMENT_METHODS, paymentMethodLabel, sumPayments } from '@chrono/sdk';

import { toISODate } from '@/lib/date';
import { useInvoicePayments, useInvoicePaymentMutations } from '@/lib/hooks/use-invoice-payments';
import { SectionHeader } from '@/components/common/SectionHeader';
import { InlineError } from '@/components/common/ErrorState';

export interface PaymentsSectionProps {
  invoiceId: string;
  companyId: string;
  currency: string;
  /** Managers can record & delete payments; others see them read-only. */
  canManage: boolean;
  userId: string | undefined;
}

/** Manual payments recorded against an invoice (actual disbursements). */
export function PaymentsSection({ invoiceId, companyId, currency, canManage, userId }: PaymentsSectionProps) {
  const { data: payments } = useInvoicePayments(invoiceId);
  const { record, remove, isPending, error } = useInvoicePaymentMutations();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(new Date());
  const [method, setMethod] = useState('bank_transfer');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | undefined>();

  const list = payments ?? [];
  const total = sumPayments(list);

  const submit = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter an amount greater than 0');
      return;
    }
    if (!userId) return;
    setFormError(undefined);
    try {
      await record({
        invoiceId,
        companyId,
        amountCents: Math.round(value * 100),
        paidOn: toISODate(paidOn),
        method,
        note: note.trim() || null,
        recordedBy: userId,
      });
      setAmount('');
      setNote('');
      setOpen(false);
    } catch {
      // Surfaced via `error` below.
    }
  };

  return (
    <View style={styles.wrap}>
      <SectionHeader
        eyebrow="Disbursed"
        title="Payments"
        action={
          canManage && !open ? <Button title="Record" size="sm" variant="secondary" onPress={() => setOpen(true)} /> : undefined
        }
      />

      {open ? (
        <Card padding="lg" style={styles.form}>
          <TextField label="Amount" value={amount} onChangeText={setAmount} placeholder="e.g. 600" keyboardType="decimal-pad" />
          <DatePicker label="Paid on" value={paidOn} onChange={setPaidOn} maximumDate={new Date()} />
          <Picker label="Method" value={method} onValueChange={setMethod} options={[...PAYMENT_METHODS]} />
          <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Reference…" />
          {formError ? (
            <Txt variant="caption" tone="danger">
              {formError}
            </Txt>
          ) : null}
          {error ? <InlineError error={error} describe={{ fallback: 'Could not record the payment.' }} /> : null}
          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
            <Button title="Save payment" onPress={submit} loading={isPending} />
          </View>
        </Card>
      ) : null}

      {list.length === 0 && !open ? (
        <Txt variant="caption" tone="textMuted">
          No payments recorded yet.
        </Txt>
      ) : (
        <Card padding="lg" style={styles.list}>
          {list.map((p) => (
            <Row key={p.id} label={`${p.paid_on} · ${paymentMethodLabel(p.method)}`}>
              <View style={styles.rowRight}>
                <Money cents={p.amount_cents} currency={currency} />
                {canManage ? (
                  <IconButton name="trash-outline" size={18} tone="textMuted" onPress={() => void remove(p.id)} accessibilityLabel="Delete payment" />
                ) : null}
              </View>
            </Row>
          ))}
          <View style={styles.total}>
            <Row label="Total paid out">
              <Money cents={total} currency={currency} tone="success" />
            </Row>
          </View>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  form: { gap: spacing.md },
  list: { gap: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  total: { marginTop: spacing.xs },
});
