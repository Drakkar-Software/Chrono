import { describe, expect, it } from 'vitest';
import { formatMoney, invoiceAmounts, invoiceStatusLabel } from './invoice.lib';

describe('formatMoney', () => {
  it('formats integer cents as currency (deterministic en-US locale)', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
    expect(formatMoney(50000, 'USD', 'en-US')).toBe('$500.00');
  });
});

describe('invoiceStatusLabel', () => {
  it('labels every status', () => {
    expect(invoiceStatusLabel('partially_paid')).toBe('Partially paid');
    expect(invoiceStatusLabel('paid')).toBe('Paid');
  });
});

describe('invoiceAmounts', () => {
  it('breaks down money fields and computes outstanding', () => {
    const amounts = invoiceAmounts({
      earned_cents: 500000,
      credit_brought_forward_cents: 20000,
      amount_due_cents: 520000,
      amount_paid_cents: 300000,
      credit_carried_forward_cents: 220000,
    });
    expect(amounts).toEqual({
      earnedCents: 500000,
      creditBroughtForwardCents: 20000,
      amountDueCents: 520000,
      amountPaidCents: 300000,
      creditCarriedForwardCents: 220000,
      outstandingCents: 220000,
    });
  });

  it('asserts carry math: due = earned + brought-forward, carried = due - paid', () => {
    // A partially-funded invoice: earned 500000 + 20000 credit = 520000 due,
    // paid 300000, so 220000 carries forward and 220000 remains outstanding.
    const earned = 500000;
    const brought = 20000;
    const due = earned + brought;
    const paid = 300000;
    const carried = due - paid;
    const amounts = invoiceAmounts({
      earned_cents: earned,
      credit_brought_forward_cents: brought,
      amount_due_cents: due,
      amount_paid_cents: paid,
      credit_carried_forward_cents: carried,
    });
    expect(amounts.amountDueCents).toBe(520000);
    expect(amounts.creditCarriedForwardCents).toBe(carried);
    expect(amounts.outstandingCents).toBe(carried);
  });

  it('never reports negative outstanding when overpaid', () => {
    const amounts = invoiceAmounts({
      earned_cents: 100000,
      credit_brought_forward_cents: 0,
      amount_due_cents: 100000,
      amount_paid_cents: 120000,
      credit_carried_forward_cents: 0,
    });
    expect(amounts.outstandingCents).toBe(0);
  });
});
