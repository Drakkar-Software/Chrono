import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, DatePicker, IconButton, Money, Picker, Row, TextField, TitledCard, Txt, spacing } from '@chrono/ui';
import { PAYMENT_METHODS, paymentMethodLabel, sumPayments } from '@chrono/sdk';

import { toISODate } from '@/lib/date';
import { useInvoicePayments, useInvoicePaymentMutations } from '@/lib/hooks/use-invoice-payments';
import { SectionHeader } from '@/components/common/SectionHeader';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
      setFormError(t('comp.invoice.errAmount'));
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
        eyebrow={t('comp.invoice.disbursed')}
        title={t('comp.invoice.payments')}
        action={
          canManage && !open ? <Button title={t('comp.invoice.record')} size="sm" variant="secondary" onPress={() => setOpen(true)} /> : undefined
        }
      />

      {open ? (
        <TitledCard title={t('comp.invoice.record')}>
          <TextField label={t('common.amount')} value={amount} onChangeText={setAmount} placeholder={t('comp.invoice.amountPlaceholder')} keyboardType="decimal-pad" />
          <DatePicker label={t('comp.invoice.paidOn')} value={paidOn} onChange={setPaidOn} maximumDate={new Date()} />
          <Picker label={t('comp.invoice.method')} value={method} onValueChange={setMethod} options={[...PAYMENT_METHODS]} />
          <TextField label={t('comp.invoice.noteOptional')} value={note} onChangeText={setNote} placeholder={t('comp.invoice.notePlaceholder')} />
          <InlineError message={formError} />
          {error ? <InlineError error={error} describe={{ fallback: t('comp.invoice.recordFail') }} /> : null}
          <FormActions
            submitLabel={t('comp.invoice.savePayment')}
            onSubmit={submit}
            busy={isPending}
            onCancel={() => setOpen(false)}
            layout="row"
          />
        </TitledCard>
      ) : null}

      {list.length === 0 && !open ? (
        <Txt variant="caption" tone="textMuted">
          {t('comp.invoice.noPayments')}
        </Txt>
      ) : (
        <Card padding="lg" style={styles.list}>
          {list.map((p) => (
            <Row key={p.id} label={`${p.paid_on} · ${paymentMethodLabel(p.method)}`}>
              <View style={styles.rowRight}>
                <Money cents={p.amount_cents} currency={currency} />
                {canManage ? (
                  <IconButton name="trash-outline" size={18} tone="textMuted" onPress={() => void remove(p.id)} accessibilityLabel={t('comp.invoice.deletePayment')} />
                ) : null}
              </View>
            </Row>
          ))}
          <View style={styles.total}>
            <Row label={t('comp.invoice.totalPaidOut')}>
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
  list: { gap: spacing.xs },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  total: { marginTop: spacing.xs },
});
