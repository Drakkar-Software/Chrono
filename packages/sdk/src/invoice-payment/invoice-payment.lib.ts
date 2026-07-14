import type { InvoicePayment } from './invoice-payment.entity';

/** Total of recorded payments (cents). */
export function sumPayments(payments: Pick<InvoicePayment, 'amount_cents'>[]): number {
  return payments.reduce((acc, p) => acc + (p.amount_cents ?? 0), 0);
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  other: 'Other',
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Payment';
  return METHOD_LABELS[method] ?? method;
}

export const PAYMENT_METHODS = [
  { label: 'Bank transfer', value: 'bank_transfer' },
  { label: 'Card', value: 'card' },
  { label: 'Cash', value: 'cash' },
  { label: 'Other', value: 'other' },
] as const;
