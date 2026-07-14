import { describe, expect, it } from 'vitest';
import { paymentMethodLabel, sumPayments } from './invoice-payment.lib';

describe('sumPayments', () => {
  it('totals amounts', () => {
    expect(sumPayments([{ amount_cents: 1000 }, { amount_cents: 500 }])).toBe(1500);
    expect(sumPayments([])).toBe(0);
  });
});

describe('paymentMethodLabel', () => {
  it('maps known methods, passes through unknown, defaults null', () => {
    expect(paymentMethodLabel('bank_transfer')).toBe('Bank transfer');
    expect(paymentMethodLabel('wire')).toBe('wire');
    expect(paymentMethodLabel(null)).toBe('Payment');
  });
});
